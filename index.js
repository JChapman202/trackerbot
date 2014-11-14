var Promise = require("bluebird");
var five = require("johnny-five");
var LineSensor = require("./LineSensor");
var keypress = require("keypress");

keypress(process.stdin);

process.stdin.setRawMode(true);
process.stdin.resume();

var maxSpeed = 200; //0-255 value, 255 is currently fast for the bot
var speedDifferential = 50; //amount to change speed when a single degree of turn is required to find the line

var middleThreshold = 550;
var leftThreshold = 440;
var rightThreshold = 380;

//TODO: add support for calibration of photoresitors.

var board = new five.Board();

// var board = new five.Board({
// 	port: "/dev/tty.TrackBot-DevB"
// });

process.on('SIGINT', function() {
	led.off();
	leftMotor.stop();
	rightMotor.stop();

});

var lineSensors = {
	left: null,
	middle: null,
	right: null
};

var lineSensors = [];

var leftMotor = null;
var rightMotor = null;
var led = null;

board.on("ready", function() {
	led = new five.Led(7);
	led.on();

	leftMotor = new five.Motor({
		pins: [6, 5],
		invertPWM: true
	});

	rightMotor = new five.Motor({
		pins: [3, 2],
		invertPWM: true
	});

	var photoResistorRight = five.Sensor({
		pin: "A2",
		freq: 10
	});

	var photoResistorMiddle = five.Sensor({
		pin: "A1",
		freq: 10
	});

	var photoResistorLeft = five.Sensor({
		pin: "A0",
		freq: 10
	});

	lineSensors.left = new LineSensor({
		sensor: photoResistorLeft,
		threshold: leftThreshold,
		name: "left"
	});

	lineSensors.middle = new LineSensor({
		sensor: photoResistorMiddle,
		threshold: middleThreshold,
		name: "middle"
	});

	lineSensors.right = new LineSensor({
		sensor: photoResistorRight,
		threshold: rightThreshold,
		name: "right"
	});

	console.log("Place the robot just behind the start of the line.  It will drive on to and then off of the line to calibrate.");
	console.log("press any key to begin calibration");
	waitForInput()
		.then(function() {
			lineSensors.left.startCalibration();
			lineSensors.middle.startCalibration();
			lineSensors.right.startCalibration();
		})
		.then(function() {
			leftMotor.forward(160);
			rightMotor.forward(160);
		})
		.delay(1500)
		.then(function() {
			leftMotor.stop();
			rightMotor.stop();
		})
		.delay(500)
		.then(function() {
			leftMotor.reverse(160);
			rightMotor.reverse(160);
		})
		.delay(1500)
		.then(function() {
			leftMotor.stop();
			rightMotor.stop();
		})
		.then(function() {
			lineSensors.left.endCalibration();
			lineSensors.middle.endCalibration();
			lineSensors.right.endCalibration();

			console.log("calibration complete.  Place robot on the line and press any key to begin");
		})
		.then(waitForInput)
		.then(function() {
			console.log("bot running.  press any key to terminate");

			processLineSensors();
			lineSensors.left.on("change", processLineSensors);
			lineSensors.middle.on("change", processLineSensors);
			lineSensors.right.on("change", processLineSensors);

			waitForInput()
				.then(function() {
					console.log("exiting robot");
					terminate();
				});
		});
});

function terminate() {
	leftMotor.stop();
	rightMotor.stop();
	led.off();

	lineSensors.left.removeAllListeners("change");
	lineSensors.middle.removeAllListeners("change");
	lineSensors.right.removeAllListeners("change");

	//ensure that there is enough time to send the proper events over serial before exiting the process
	setTimeout(function() {
		process.exit(0);
	}, 1000);
}

function waitForInput() {
	return new Promise(function(resolve) {
		process.stdin.on("keypress", function(ch, key) {
			resolve()
		});
	});
}

function processLineSensors() {
	console.log("processing sensors");

	if (lineSensors.left.onLine && lineSensors.middle.onLine && lineSensors.right.onLine) {
		console.log("right on the line");

		leftMotor.forward(maxSpeed);
		rightMotor.forward(maxSpeed);
	}
	else if (!lineSensors.left.onLine && lineSensors.middle.onLine && lineSensors.right.onLine) {
		console.log("trailing to the right");

		leftMotor.forward(maxSpeed);
		rightMotor.forward(maxSpeed - speedDifferential);
	}
	else if (!lineSensors.left.onLine && !lineSensors.middle.onLine && lineSensors.right.onLine) {
		console.log("trailing HARD to the right");

		leftMotor.forward(maxSpeed);
		rightMotor.reverse(maxSpeed);
	}
	else if (lineSensors.left.onLine && lineSensors.middle.onLine && !lineSensors.right.onLine) {
		console.log("trailing to the left");

		leftMotor.forward(maxSpeed - speedDifferential);
		rightMotor.forward(maxSpeed);
	}
	else if (lineSensors.left.onLine && !lineSensors.middle.onLine && !lineSensors.right.onLine) {
		console.log("trailing HARD to the left");

		leftMotor.reverse(maxSpeed);
		rightMotor.forward(maxSpeed);
	}
	else {
		console.log("lost the line");

		//this state means we don't know where the line is at all, we need to stop.
		leftMotor.stop();
		rightMotor.stop();
	}
}
