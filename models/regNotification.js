const mongoose = require('mongoose');

const regNotificationSchema = new mongoose.Schema({
    message: {
        type: String,
        required: true,
        trim: true
    },
    registrant: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    type: {
        type: String,
        enum: ['registration', 'user', 'alert', 'success', 'info'],
        default: 'registration'
    },
    readBy: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],

    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

regNotificationSchema.index({ createdAt: -1 });

regNotificationSchema.index({ readBy: 1 });

const RegNotification = mongoose.model('RegNotification', regNotificationSchema);
module.exports = RegNotification;