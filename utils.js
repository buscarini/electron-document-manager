const path = require('path')

export let removeExt = filePath => filePath.substr(0, filePath.lastIndexOf('.'))
export let windowTitle = filePath => removeExt(basename(filePath))
