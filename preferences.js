'use strict';
const _ = require('lodash');

const pref = require('electron-pref')

const preferences = pref.from({
});

let settings = {
	get: (k, cb) => {
		cb(null, preferences.get(k))
	},
	set: (k,v, cb) => {
		preferences.set(k, v)
		cb()
	}
}

module.exports = {
  preferences: settings
}

