const Shortlist = require("../models/shortlistDetails");
const getAllShortlists = async (req, res) => {
  try {
    const {
      search,
      status,
      sectorOfInterest,
      page = 1,
      limit = 10,
      sort = "createdAtDesc",
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const limitNum = parseInt(limit);

    // Build match stage
    let matchStage = {};

    if (status) {
      matchStage.status = status;
    }

    if (sectorOfInterest) {
      matchStage["user.sectorOfInterest"] = sectorOfInterest;
    }

    if (search) {
      const regex = new RegExp(search, "i");
      matchStage.$or = [
        { "user.fullName": regex },
        { "user.mobileNumber": regex },
        { location: regex },
      ];
    }

    // Build sort stage
    let sortStage = { createdAt: -1 }; // Default
    if (sort === "createdAtAsc") {
      sortStage = { createdAt: 1 };
    } else if (sort === "nameAsc") {
      sortStage = { "user.fullName": 1 };
    } else if (sort === "nameDesc") {
      sortStage = { "user.fullName": -1 };
    }

    // Aggregation pipeline
    const pipeline = [
      {
        $lookup: {
          from: "users", // collection name (should match actual MongoDB collection)
          localField: "user",
          foreignField: "_id",
          as: "user",
        },
      },
      {
        $unwind: "$user",
      },
      {
        $match: matchStage,
      },
      {
        $sort: sortStage,
      },
      {
        $skip: skip,
      },
      {
        $limit: limitNum,
      },
      {
        $project: {
          _id: 1,
          status: 1,
          date: 1,
          time: 1,
          location: 1,
          createdAt: 1,
          user: {
            _id: 1,
            fullName: 1,
            mobileNumber: 1,
            sectorOfInterest: 1,
            createdAt: 1,
          },
        },
      },
    ];

    const shortlists = await Shortlist.aggregate(pipeline);

    // Get total count separately
    const countPipeline = [
      {
        $lookup: {
          from: "users",
          localField: "user",
          foreignField: "_id",
          as: "user",
        },
      },
      { $unwind: "$user" },
      { $match: matchStage },
      { $count: "total" },
    ];

    const countResult = await Shortlist.aggregate(countPipeline);
    const totalShortlists = countResult[0]?.total || 0;

    res.status(200).json({
      success: true,
      shortlists,
      totalShortlists,
      totalPages: Math.ceil(totalShortlists / limitNum),
      currentPage: parseInt(page),
    });
  } catch (error) {
    console.error("Error getting all shortlists:", error);
    res.status(500).json({
      success: false,
      message: "An error occurred while fetching shortlists.",
    });
  }
};
const deleteShortlistById = async (req, res) => {
  try {
    const shortlist = await Shortlist.findByIdAndDelete(req.params.id);
    if (!shortlist) {
      return res.status(400).json({
        success: false,
        message: "Provider  ID Not Found in DB",
      });
    }

    return res.status(200).json({
      success: true,
      shortlist,
      message: "Data Deleted Successfully",
    });
  } catch (error) {
    return res.status(500).send("Internal Server Error");
  }
};
module.exports = {
  getAllShortlists,
  deleteShortlistById,
};
