'use strict';

let electron = require('electron')
let app = electron.app
let BrowserWindow = electron.BrowserWindow
let path = require('path')
let _ = require('lodash')
let { windowTitle } = require('./utils')

let fileManager = require('./fileManager')

let Container = (win, path) => {
	return {
		window: win,
		id: win.id,
		filePath: path
	}
}

var containers = []
var untitledIndex = 1;
var indexFile
var shouldCloseWindow
var openDevTools
var appIsQuitting = false

var focusUpdateHandler = null;

function createWindow(options) {
	options = options || {}
	
	let onChange = _.defaultTo(options.onChange, x => x)
	
	let ext = options.docExtension || ".onemodel"

	//pick a title (set as BrowserWindow.title and send with set-title)
	var title = options.filePath ? windowTitle(options.filePath) : ( "Untitled " + untitledIndex++ );

	var parameters = {
		x: _.defaultTo(options.x, null),
		y: _.defaultTo(options.y, null),
		width: _.defaultTo(options.width, 900),
		height: _.defaultTo(options.height, 600),
		title: title
	};

	if(options.focusedWindow) {
		var bounds = options.focusedWindow.getBounds();
		parameters = _.extend(parameters, {
			x: bounds.x + 20,
			y: bounds.y + 20
		});
	}

	parameters = _.extend(parameters, { show: false })

	// Create the browser window.
	var win = null
	win = new BrowserWindow(parameters);
	win.once('ready-to-show', () => {
	  win.show()
	})
	
	let container = Container(win, options.filePath, options.tmpPath)
	containers.push(container)

	// and load the index.html of the app.
	win.loadURL(indexFile)

	win.webContents.on('did-finish-load', function() {
		setUpWindow(win, options.filePath, options.fileContent);
	});
	
	let filePath = options.filePath

	let winId = win.id


	// win.on('close', (e) => {
// 		if (shouldCloseWindow()) e.preventDefault()
// 	})
		//
	// win.onbeforeunload = (e) => {
	// 	console.log('I do not want to be closed')
	// 	// if () e.preventDefault()
	// 	// e.returnValue = shouldCloseWindow()
	// 	e.returnValue = false
	// 	return false
	// }
	
    // win.addEventListener('beforeunload', function (event) {
//        var answer = confirm('Do you want to quit ?');
//        event.returnValue = answer;
//      });

	win.on('close', function(e) {
		e.preventDefault()
		
		fileManager.close(win, ext, performClose => {
			containers = _.filter(containers, container => container.id !== winId)
			if (win) {
				win.hide()
				win.destroy()
				win = null
			}
		})
	})
	
	win.on('closed', function() {
		containers = _.filter(containers, container => container.id !== winId)
		
		if (appIsQuitting && containers.length == 0) {
			app.exit(0)
		}
	})

	win.on('move', () => onChange())
	win.on('resize', () => onChange())

	if(focusUpdateHandler) {
		focusUpdateHandler();
		win.on('focus', focusUpdateHandler);
		win.on('blur', focusUpdateHandler);
	}
	
	if (openDevTools) {
		win.webContents.openDevTools()
	}
	
	return win
}

function setUpWindow(win, filePath, contents) {
	if (filePath) {
		containers = _.map(containers, c => {
			if (c.window.id === win.id) {
				c.path = filePath
			}
			return c
		})
		
		win.webContents.send('set-filepath', filePath)
		win.setRepresentedFilename(filePath)
		win.setTitle(windowTitle(filePath))
	}
	if(contents) {
		win.webContents.send('set-content', contents)
	}
}

module.exports = {
	createWindow: createWindow,
	setUpWindow: setUpWindow,
	//note: focus and blur handlers will only apply to future windows at creation
	setFocusUpdateHandler: function(func) {
		focusUpdateHandler = func
	},
	initializeWithEntryPoint: function(entryPointArg, askCloseWindow, showDevTools) {
		indexFile = entryPointArg
		shouldCloseWindow = askCloseWindow
		openDevTools = showDevTools
 	},
	windowCloseCancelled: () => {
		appIsQuitting = false
	},
	getWindowContainers: function() { return containers },
	getWindows: function() { return _.map(containers, c => c.window) },
	setQuitting: function(isQuitting) {
		appIsQuitting = isQuitting
	}
};
