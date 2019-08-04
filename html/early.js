// This was functionality of script.js, moved it to here to start the downloading of track history earlier
"use strict";
var Dump1090Version = "unknown version";
var RefreshInterval = 1000;
var enable_uat = false;
var HistoryChunks = false;
var nHistoryItems = 0;
var PositionHistoryBuffer = [];
var	receiverJson;
var deferHistory = [];
var configureReceiver = $.Deferred();

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


$.when(get_receiver_defer).done(function(data){
	get_receiver_defer = null;
	receiverJson = data;
	Dump1090Version = data.version;
	RefreshInterval = data.refresh;
	nHistoryItems = data.history;

	$.when(test_chunk_defer).done(function(data) {
		test_chunk_defer = null;
		HistoryChunks = true;
		nHistoryItems = data.chunks;
		enable_uat = (data.enable_uat == "true");
		if (enable_uat)
			console.log("UAT/978 enabled!");
		console.log("Chunks enabled");
		get_history();
	}).fail(function() {
		HistoryChunks = false;
		get_history();
	});
});

function get_history() {

	$.ajax({ url: 'data/aircraft.json',
		timeout: 5000,
		cache: false,
		dataType: 'json' }).done(function(data) {
			PositionHistoryBuffer.push(data);
		});

	if (nHistoryItems > 0) {
		console.log("Starting to load history (" + nHistoryItems + " items)");
		console.time("Downloaded History");
		// Queue up the history file downloads
		for (var i = 0; i < nHistoryItems; i++) {
			get_history_item(i);
		}
	}
	configureReceiver.resolve();
}

function get_history_item(i) {

	var request;

	if (HistoryChunks) {
		request = $.ajax({ url: 'chunks/chunk_' + i + '.gz',
			timeout: nHistoryItems * 4000, // Allow 4s load time per history chunk
			dataType: 'json'
		});
	} else {

		request = $.ajax({ url: 'data/history_' + i + '.json',
			timeout: nHistoryItems * 120, // Allow 40 ms load time per history entry
			cache: false,
			dataType: 'json' });
	}
	deferHistory.push(request);
}
