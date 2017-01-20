'use strict';

const electron = require('electron');
const app = electron.app;
const BrowserWindow = electron.BrowserWindow;
const path = require('path');
const _ = require('lodash');
const { windowTitle } = require('./utils')

let Container = (win, path) => {
	return {
		window: win,
		id: win.id,
		filePath: path
	}
}

var containers = []
var untitledIndex = 1;
var indexFile;

var focusUpdateHandler = null;

function createWindow(options) {
	options = options || {};
	
	let onChange = _.defaultTo(options.onChange, x => x)

	//pick a title (set as BrowserWindow.title and send with set-title)
	var title = options.filepath ? windowTitle(options.filepath) : ( "Untitled " + untitledIndex++ );

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
	
	let container = Container(win, options.filepath)
	containers.push(container)

	// and load the index.html of the app.
	win.loadURL(indexFile);

	win.webContents.on('did-finish-load', function() {
		setUpWindow(win, options.filepath, options.fileContent);
	});
	
	let filePath = options.filepath

	let winId = win.id
		
	win.on('closed', function() {
		containers = _.filter(containers, container => container.id !== winId)
	});

	win.on('move', () => onChange())
	win.on('resize', () => onChange())

	if(focusUpdateHandler) {
		focusUpdateHandler();
		win.on('focus', focusUpdateHandler);
		win.on('blur', focusUpdateHandler);
	}
	
	return win
}

function setUpWindow(win, filepath, contents) {
	if (filepath) {
		containers = _.map(containers, c => {
			if (c.window.id === win.id) {
				c.path = filepath
			}
			return c
		})
		
		win.webContents.send('set-filepath', filepath)
		win.setRepresentedFilename(filepath)
		win.setTitle(windowTitle(filepath))
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
    focusUpdateHandler = func;
  },
  initializeWithEntryPoint: function(entryPointArg) {
    indexFile = entryPointArg;
  },
  getWindowContainers: function() { return containers },
  getWindows: function() { return _.map(containers, c => c.window) }
};
