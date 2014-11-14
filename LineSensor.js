var util = require("util");
var events = require("events");

function LineSensor(options) {
	this.threshold = options.threshold || 500;
	this.sensor = options.sensor;
	this.name = options.name || "unknown";
	this.min = 1024;
	this.max = 0;
	this.logEnabled = false;

	this.onLine = false;
	var self = this;

	function calibrate() {
		if (this.value < self.min) {
			self.min = this.value;
		}

		if (this.value > self.max) {
			self.max = this.value;
		}
	}

	function process() {
		onLine = (this.value < self.threshold);

		if (self.logEnabled) {
			console.log(self.name + ": " + this.value + " threshold: " + self.threshold);
		}

		if (self.onLine !== onLine) {
			self.onLine = onLine;
			self.emit(events.forChange(), { onLine: onLine });
		}
	}

	this.sensor.on("data", process);

	this.startCalibration = function() {
		self.sensor.removeListener("data", process);
		self.min = 1024;
		self.max = 0;
		self.sensor.on("data", calibrate);
	};

	this.endCalibration = function() {
		self.sensor.removeListener("data", calibrate);
		self.threshold = ((self.max - self.min) * .45) + self.min;
		console.log(self.name + " calibration min: " + self.min + " max: " + self.max + " threshold: " + self.threshold);
		self.sensor.on("data", process);
	};
}

function validateOptions(options) {
	if (!options.sensor) {
		throw new Error("A 'sensor' option is required ");
	}
}

util.inherits(LineSensor, events.EventEmitter);

var events = {
	forChange: function() {
		return "change";
	}
}
module.exports = LineSensor;