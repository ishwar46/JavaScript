const age = 15;
// const isOldEnough = age >= 23;

// this is also called controlled structure or block structure
if (age >= 18) {
    console.log('I like to drink beer 🍺')
} else {
    const yearsLeft = 18 - age;
    console.log(`You are too young to drink beer, wait another ${yearsLeft} years :)`)
}


const birthYear = 2001;
let century;

if (birthYear <= 1991) {
    century = 20;
} else {
    century = 21;
}

console.log(`You are borin in ${century}th century`);