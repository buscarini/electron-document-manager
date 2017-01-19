const path = require('path')

let removeExt = filePath => filePath.substr(0, filePath.lastIndexOf('.'))
let windowTitle = filePath => removeExt(basename(filePath))

module.exports = {
	removeExt,
	windowTitle
};
