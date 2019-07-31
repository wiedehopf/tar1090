// This was functionality of script.js, moved it to here to start the downloading of track history earlier
"use strict";
var Dump1090Version = "unknown version";
var RefreshInterval = 1000;
var enable_uat = false;
var HistoryChunks = false;
var PositionHistorySize = 0;
var	receiverJson;
var deferHistory = [];

// get configuration json files, will be used in initialize function
var get_receiver_defer = $.ajax({ url: 'data/receiver.json',
	timeout: 5000,
	cache: false,
	dataType: 'json'
});
var test_chunk_defer = $.ajax({
	url:'chunks/chunks.json',
	timeout: 3000,
	cache: false,
	dataType: 'json'
});

var configureReceiver = $.when(get_receiver_defer).done(function(data){

	receiverJson = data;
	Dump1090Version = data.version;
	RefreshInterval = data.refresh;
	PositionHistorySize = data.history;

	$.when(test_chunk_defer).done(function(data) {
		HistoryChunks = true;
		PositionHistorySize = data.chunks;
		enable_uat = (data.enable_uat == "true");
		console.log("UAT/978 enabled!");
		get_history();
	}).fail(function() {
		HistoryChunks = false;
		get_history();
	});
});

function get_history() {
	if (PositionHistorySize > 0) {
		console.log("Starting to load history (" + PositionHistorySize + " items)");
		console.time("Downloaded History");
		// Queue up the history file downloads
		for (var i = 0; i < PositionHistorySize; i++) {
			get_history_item(i);
		}
	}
}

function get_history_item(i) {

	if (HistoryChunks) {

		deferHistory[i] = $.ajax({ url: 'chunks/chunk_' + i + '.gz',
			timeout: PositionHistorySize * 5000, // Allow 40 ms load time per history entry
			dataType: 'json'
		});
	} else {

		deferHistory[i] = $.ajax({ url: 'data/history_' + i + '.json',
			timeout: PositionHistorySize * 120, // Allow 40 ms load time per history entry
			cache: false,
			dataType: 'json' });
	}
}
