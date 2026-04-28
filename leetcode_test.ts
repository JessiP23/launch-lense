function canPlaceFlowers(flowerbed: number[], n: number): boolean {
    for (let i = 0; i < flowerbed.length; i++) {
        const left = i === 0 ? 0 : flowerbed[i - 1];
        const right = i === flowerbed.length - 1 ? 0 : flowerbed[i + 1];
        if (left === 0 && right === 0 && flowerbed[i] === 0) {
            flowerbed[i] = 1;
            n--;
        }
    }
    return n <= 0;
}

console.log(canPlaceFlowers([1,0,0,0,1], 1)); // true
console.log(canPlaceFlowers([1,0,0,0,1], 2)); // false
console.log(canPlaceFlowers([0,0,1,0,0], 1)); // true