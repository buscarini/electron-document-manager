const path = require('path')

let removeExt = filePath => filePath.substr(0, filePath.lastIndexOf('.'))
let windowTitle = filePath => removeExt(path.basename(filePath))
let id = x => x

module.exports = {
	removeExt,
	windowTitle,
	id
}
