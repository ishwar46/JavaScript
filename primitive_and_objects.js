// Primitive Datatypes and Objects
// There are 7 Primitive Datatypes in JavaScript

// nn bb ss u 
//number null byte bool string symbol undefined
let a = null;
let b = 321;
let c = true; //can also be false
let d = BigInt("6789") + BigInt("6789")
let e = "Harry"
let f = Symbol("Iam a good symbol")
let g = undefined

console.log(a, b, c, d, e, f, g)

console.log(typeof d)
console.log(typeof c)

//Objects in Js (Non Primitive)

const item = {
    "Ishwar": true,
    "Subham": false,
    "Chandra": 99,
    "Prabin": undefined
}

console.log(item["Ishwar"])
console.log(item["Chandra"])

