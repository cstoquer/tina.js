
function BriefExtension() {
	// Local duration of the playable, independent from speed and iterations
	this._duration = 0;

	// On complete callback
	this._onComplete = null;

	// Playing options
	this._iterations = 1; // Number of times to iterate the playable
	this._pingpong   = false; // To make the playable go backward on even iterations
	this._persist    = false; // To keep the playable running instead of completing
}

module.exports = BriefExtension;

BriefExtension.prototype.setSpeed = function (speed) {
	if (speed === 0) {
		if (this._speed !== 0) {
			// Setting timeStart as if new speed was 1
			this._startTime += this._time / this._speed - this._time;
		}
	} else {
		if (this._speed === 0) {
			// If current speed is 0,
			// it corresponds to a virtual speed of 1
			// when it comes to determing where the starting time is
			this._startTime += this._time - this._time / speed;
		} else {
			this._startTime += this._time / this._speed - this._time / speed;
		}
	}

	this._speed = speed;
	if (this._player !== null) {
		this._player._onPlayableChanged(this);
	}
};

BriefExtension.prototype.onComplete = function (onComplete) {
	this._onComplete = onComplete;
	return this;
};

BriefExtension.prototype.getDuration = function () {
	// Duration from outside the playable
	return this._duration * this._iterations / this._speed;
};

BriefExtension.prototype._setDuration = function (duration) {
	this._duration = duration;
	if (this._player !== null) {
		this._player._onPlayableChanged(this);
	}
};

BriefExtension.prototype._extendDuration = function (durationExtension) {
	this._duration += durationExtension;
	if (this._player !== null) {
		this._player._onPlayableChanged(this);
	}
};

BriefExtension.prototype._getEndTime = function () {
	if (this._speed > 0) {
		return this._startTime + this.getDuration();
	} else if (this._speed < 0) {
		return this._startTime;
	} else {
		return Infinity;
	}
};

BriefExtension.prototype._setStartTime = function (startTime) {
	if (this._speed > 0) {
		this._startTime = startTime;
	} else if (this._speed < 0) {
		this._startTime = startTime - this.getDuration();
	} else {
		this._startTime = Infinity;
	}
};

BriefExtension.prototype._getStartTime = function () {
	if (this._speed > 0) {
		return this._startTime;
	} else if (this._speed < 0) {
		return this._startTime + this.getDuration();
	} else {
		return -Infinity;
	}
};

BriefExtension.prototype._isTimeWithin = function (time) {
	if (this._speed > 0) {
		return (this._startTime < time) && (time < this._startTime + this.getDuration());
	} else if (this._speed < 0) {
		return (this._startTime + this.getDuration() < time) && (time < this._startTime);
	} else {
		return true;
	}
};

BriefExtension.prototype._overlaps = function (time0, time1) {
	if (this._speed > 0) {
		return (this._startTime - time1) * (this._startTime + this.getDuration() - time0) <= 0;
	} else if (this._speed < 0) {
		return (this._startTime + this.getDuration() - time1) * (this._startTime - time0) <= 0;
	} else {
		return true;
	}
};

BriefExtension.prototype.goToEnd = function () {
	return this.goTo(this.getDuration(), this._iterations - 1);
};

BriefExtension.prototype.loop = function () {
	return this.iterations(Infinity);
};

BriefExtension.prototype.iterations = function (iterations) {
	if (iterations < 0) {
		console.warn('[BriefExtension.iterations] Number of iterations cannot be negative');
		return this;
	}

	this._iterations = iterations;
	if (this._player !== null) {
		this._player._onPlayableChanged(this);
	}
	return this;
};

BriefExtension.prototype.persist = function (persist) {
	this._persist = persist;
	return this;
};

BriefExtension.prototype.pingpong = function (pingpong) {
	this._pingpong = pingpong;
	if (this._player !== null) {
		this._player._onPlayableChanged(this);
	}
	return this;
};

BriefExtension.prototype._complete = function (overflow) {
	if (this._persist === true) {
		// Playable is persisting
		// i.e it never completes
		this._startTime += overflow;
		this._player._onPlayableChanged(this);
		return;
	}

	// Inactivating playable before it completes
	// So that the playable can be reactivated again within _onComplete callback
	if (this._player._inactivate(this) === false) {
		// Could not be completed
		return this;
	}

	if (this._onComplete !== null) { 
		this._onComplete(overflow);
	}
};


BriefExtension.prototype._moveTo = function (time, dt, overflow) {
	dt *= this._speed;

	// So many conditions!!
	// That is why this extension exists
	if (overflow === undefined) {
		// Computing overflow and clamping time
		if (dt !== 0) {
			if (this._iterations === 1) {
				// Converting into local time (relative to speed and starting time)
				this._time = (time - this._startTime) * this._speed;
				if (dt > 0) {
					if (this._time >= this._duration) {
						overflow = this._time - this._duration;
						dt -= overflow;
						this._time = this._duration;
					}
				} else if (dt < 0) {
					if (this._time <= 0) {
						overflow = this._time;
						dt -= overflow;
						this._time = 0;
					}
				}
			} else {
				time = (time - this._startTime) * this._speed;

				// Iteration at current update
				var iteration = time / this._duration;

				if (dt > 0) {
					if (iteration < this._iterations) {
						// if (this._time !== 0 && Math.ceil(iteration) !== Math.ceil(this._time / this._duration)) {
						// }
						this._time = time % this._duration;
					} else {
						overflow = (iteration - this._iterations) * this._duration;
						dt -= overflow;
						this._time = this._duration * (1 - (Math.ceil(this._iterations) - this._iterations));
					}
				} else if (dt < 0) {
					if (0 < iteration) {
						// if (this._time !== this._duration && Math.ceil(iteration) !== Math.ceil(this._time / this._duration)) {
						// }
						this._time = time % this._duration;
					} else {
						overflow = iteration * this._duration;
						dt -= overflow;
						this._time = 0;
					}
				}

				if ((this._pingpong === true)) {
					if (Math.ceil(this._iterations) === this._iterations) {
						if (overflow === undefined) {
							if ((Math.ceil(iteration) & 1) === 0) {
								this._time = this._duration - this._time;
							}
						} else {
							if ((Math.ceil(iteration) & 1) === 1) {
								this._time = this._duration - this._time;
							}
						}
					} else {
						if ((Math.ceil(iteration) & 1) === 0) {
							this._time = this._duration - this._time;
						}
					}
				}
			}
		}
	} else {
		// Ensuring that the playable overflows when its player overflows
		// This conditional is to deal with Murphy's law:
		// There is one in a billion chance that a player completes while one of his playable
		// does not complete due to stupid rounding errors
		if (dt > 0) {
			overflow = Math.max((time - this._startTime) * this._speed - this._duration * this.iterations, 0);
			this._time = this._duration;
		} else {
			overflow = Math.min((time - this._startTime) * this._speed, 0);
			this._time = 0;
		}

		dt -= overflow;
	}

	this._update(dt, overflow);

	if (this._onUpdate !== null) {
		this._onUpdate(this._time, dt);
	}

	if (overflow !== undefined) {
		this._complete(overflow);
	}
};