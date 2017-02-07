const electron = require('electron');
const app = electron.app;
const BrowserWindow = electron.BrowserWindow;
const Menu = electron.Menu;
const MenuItem = electron.MenuItem;
const _ = require('lodash');
const nodePath = require('path')


function getMenuTemplate(options) {
	
	let separator = { type: 'separator' }
	
	console.log("menu template " + JSON.stringify(options.recentDocs))
	
	let recentDocs = _.uniqBy(_.filter(options.recentDocs || [], doc => typeof doc === "object" && doc.filePath.length > 0), "filePath")

	console.log("recent docs " + JSON.stringify(recentDocs))
	
	let recentDocsSubmenu = _.map(recentDocs, doc => {
		console.log(doc)
		console.log(doc.filePath)
		return {
			label: nodePath.basename(doc.filePath),
			click: (item, focusedWindow) => {
				console.log("open " + doc.filePath)
				options.openMethod(item, focusedWindow, null, doc.filePath)
			}
		}
	})
	
	let recentDocsMenu = _.concat(recentDocsSubmenu, [
				separator,
				{
					label : "Clear Menu",
					click: event => {
						let clear = options.clearRecentDocs || id
						clear()
					},
					enabled: recentDocs.length > 0
				}
			])
	
  var template = [
    {
      label:  'File',
	  id: "file",
      submenu: [
        {
          label: 'New',
          accelerator: 'CmdOrCtrl+N',
          click: options.newMethod,
		  id: 'new'
        },
        {
          label: 'Open',
          accelerator: 'CmdOrCtrl+O',
          click: options.openMethod,
		  id: 'open'
        },
        {
          label: 'Open Recent',
		  id: 'openrecent',
		  submenu: recentDocsMenu
        },
        separator,
        {
          label: 'Save',
          accelerator: 'CmdOrCtrl+S',
          enabled: options.isFocusedWindow,
          click: options.saveMethod,
		  id: 'save'
        },
        {
          label: 'Save As',
          accelerator: 'CmdOrCtrl+Shift+S',
          enabled: options.isFocusedWindow,
          click: options.saveAsMethod,
		  id: 'save_as'
        },
        {
          label: 'Rename',
          enabled: options.isFocusedWindow, //FIX
          click: options.renameMethod,
		  id: 'rename'
        },
        {
          label: 'Close',
          accelerator: 'CmdOrCtrl+W',
          enabled: options.isFocusedWindow,
          click: options.closeMethod,
		  id: 'close'
        }
      ]
    },
    {
      label: 'Edit',
	  id: 'edit',
      submenu: [
        {
          label: 'Undo',
          accelerator: 'CmdOrCtrl+Z',
          role: 'undo',
		  id: 'undo'
        },
        {
          label: 'Redo',
          accelerator: 'Shift+CmdOrCtrl+Z',
          role: 'redo',
		  id: 'redo'
        },
        separator,
        {
          label: 'Cut',
          accelerator: 'CmdOrCtrl+X',
          role: 'cut',
		  id: 'cut'
        },
        {
          label: 'Copy',
          accelerator: 'CmdOrCtrl+C',
          role: 'copy',
		  id: 'copy'
        },
        {
          label: 'Paste',
          accelerator: 'CmdOrCtrl+V',
          role: 'paste',
		  id: 'paste'
        },
        {
          label: 'Duplicate',
          accelerator: 'CmdOrCtrl+D',
          role: 'duplicate',
		  id: 'duplicate'
        },
        {
          label: 'Select All',
          accelerator: 'CmdOrCtrl+A',
          role: 'selectall',
		  id: 'selectall'
        },
      ]
    },
    {
      label: 'View',
	  id: 'view',
      submenu: [
        {
          label: 'Reload',
	      id: 'reload',
          accelerator: 'CmdOrCtrl+R',
          click: function(item, focusedWindow) {
            if (focusedWindow) {
              focusedWindow.reload();
            }
          }
        },
        {
          label: 'Toggle Full Screen',
	   	  id: 'fullscreen',
          accelerator: (function() {
            if (process.platform == 'darwin')
              return 'Ctrl+Command+F';
            else
              return 'F11';
          })(),
          click: function(item, focusedWindow) {
            if (focusedWindow)
              focusedWindow.setFullScreen(!focusedWindow.isFullScreen());
          }
        },
        {
          label: 'Toggle Developer Tools',
	      id: 'developer_tools',
          accelerator: (function() {
            if (process.platform == 'darwin')
              return 'Alt+Command+I';
            else
              return 'Ctrl+Shift+I';
          })(),
          click: function(item, focusedWindow) {
            if (focusedWindow) {
              focusedWindow.toggleDevTools();
            }
          }
        },
      ]
    },
    {
      label: 'Window',
      role: 'window',
	  id: 'window',
      submenu: [
        {
          label: 'Minimize',
          accelerator: 'CmdOrCtrl+M',
          role: 'minimize',
		  id: 'minimize'
        }
      ]
    },
    {
      label: 'Help',
      role: 'help',
	  id: 'help',
      submenu: [
        {
          label: 'Learn More',
          click: function() { require('electron').shell.openExternal('http://electron.atom.io') }
        },
      ]
    },
  ];

  if (process.platform == 'darwin') {
    var name = require('electron').app.getName();
    template.unshift({
      label: name,
      submenu: [
        {
          label: 'About ' + name,
          role: 'about',
		  id: 'about'
        },
        separator,
        {
          label: 'Services',
          role: 'services',
		  id: 'services',
          submenu: []
        },
        separator,
        {
          label: 'Hide ' + name,
          accelerator: 'Command+H',
          role: 'hide',
		  id: 'hide'
        },
        {
          label: 'Hide Others',
          accelerator: 'Command+Shift+H',
          role: 'hideothers',
		  id: 'hideothers'
        },
        {
          label: 'Show All',
          role: 'unhide',
		  id: 'unhide'
        },
        separator,
        {
          label: 'Quit',
          accelerator: 'Command+Q',
          click: function() {
			  app.quit()
		  },
	      id: 'quit'
        },
      ]
    });

    // Window menu.
    template[3].submenu.push(
      separator,
      {
        label: 'Bring All to Front',
        role: 'front',
	    id: 'front'
      }
    );

  }

  return template;
}

//options saved from last time - so that you can just change a few
var globalOptions = {};

let id = a => { return a }

function setMenu(options) {
	console.log("set menu")
	
  globalOptions = _.extend(globalOptions, options); //overwrite with later args
  var template = getMenuTemplate(globalOptions);

  let processMenu = (options.processMenu === undefined || options.processMenu === null) ? id : options.processMenu

  var menu = Menu.buildFromTemplate(processMenu(template));
  Menu.setApplicationMenu(menu);
}

function updateMenu(options) {	
	setImmediate(function() { // electron bug - focused window is still defined on tick of blur event
		
		options.isFocusedWindow = !!BrowserWindow.getFocusedWindow()// see https://github.com/atom/electron/issues/984
		
		setMenu(options)
	});
}

module.exports = {
  setMenu: setMenu, //do the initial setup
  updateMenu: updateMenu //updates focused window state
};
