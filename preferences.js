"use strict"

const pref = require("electron-pref")

const preferences = pref.from({})

const settings = {
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

