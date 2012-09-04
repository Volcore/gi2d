function Sqr(x) { return x * x; }
function Rotate(x, angle) {
  var c = Math.cos(angle);
  var s = Math.sin(angle);
  return [c * x[0] - s * x[1], s * x[0] + c * x[1]];
}

kWallWidth = 5.0

function Line(start, end) {
  this.start = start;
  this.end = end;
  this.length = function() {
    return Math.sqrt(Sqr(this.end[0] - this.start[0]) + Sqr(this.end[1] - this.start[1]));
  }
  this.locationForParameter = function(t) {
    return [(this.end[0] - this.start[0]) * t + this.start[0],
            (this.end[1] - this.start[1]) * t + this.start[1]];
  }
  this.direction = function() {
    var length = this.length();
    return [(this.end[0] - this.start[0])/length,
            (this.end[1] - this.start[1])/length];
  }
  this.normal = function() {
    return Rotate(this.direction(), Math.PI/2.0)
  }
}

function Wall(line, irradiance, diffuse) {
  this.line = line;
  this.irradiance = irradiance;
  this.diffuse = diffuse;
}

function GI2D(canvas) {
  this.canvas_ = canvas;
  this.walls_ = [];
  this.currentScale_ = [1.0, 1.0];
  this.currentOffset_ = [0.0, 0.0];
  this.numHemiRays_ = 8;
  this.setCanvas = function(canvas) {
    this.canvas_ = canvas;
  }
  this.setNumHemiRays = function(num) {
    this.numHemiRays_ = num;
  }
  this.addWall = function(wall) {
    this.walls_.push(wall);
    return this.walls_.length-1;
  }
  this.computeScaleOffset = function() {
    var ctx = this.canvas_.getContext("2d");
    var width = ctx.canvas.width;
    var height = ctx.canvas.height;
    // Compute bounds of geometry
    var min = [99999999.9, 99999999.9];
    var max = [-99999999.9, -99999999.9];
    for (var wall_idx in this.walls_) {
      var wall = this.walls_[wall_idx];
      for (var i = 0; i < 2; ++i) {
        min[i] = Math.min(wall.line.start[i], min[i]);
        min[i] = Math.min(wall.line.end[i], min[i]);
        max[i] = Math.max(wall.line.start[i], max[i]);
        max[i] = Math.max(wall.line.end[i], max[i]);
      }
    }
    // Compute isotropic scale and anisotropic offsets to map it into the canvas
    var border = 100.0;
    var scale = [(width - border)/(max[0]-min[0]), (height - border)/(max[1]-min[1])];
    if (scale[0] < scale[1]) {
      scale[1] = scale[0];
    } else {
      scale[0] = scale[1];
    }
    var offset = [(width - (max[0]-min[0]) * scale[0])/2.0 - min[0] * scale[0], (height - (max[1]-min[1]) * scale[1])/2.0 - min[1] * scale[1]];
    this.currentScale_ = scale;
    this.currentOffset_ = offset;
  }
  this.drawScene = function() {
    var ctx = this.canvas_.getContext("2d");
    var width = ctx.canvas.width;
    var height = ctx.canvas.height;
    // Clear the canvas
    ctx.clearRect (0, 0, width, height);
    // Draw background
    ctx.fillStyle = "#C3D9FF";
    ctx.fillRect(0, 0, width, height);
    // Fetch scale and offset
    this.computeScaleOffset();
    var scale = this.currentScale_;
    var offset = this.currentOffset_;
    // Draw the scene geometry
    for (var wall_idx in this.walls_) {
      var wall = this.walls_[wall_idx];
      var a = [wall.line.start[0] * scale[0] + offset[0], wall.line.start[1] * scale[1] + offset[1]];
      var b = [wall.line.end[0] * scale[0] + offset[0], wall.line.end[1] * scale[1] + offset[1]];
      var n = wall.line.normal();
      var width = kWallWidth;
      ctx.beginPath()
      ctx.moveTo(a[0] + width * n[0], a[1] + width * n[1]);
      ctx.lineTo(b[0] + width * n[0], b[1] + width * n[1]);
      ctx.lineTo(b[0] - width * n[0], b[1] - width * n[1]);
      ctx.lineTo(a[0] - width * n[0], a[1] - width * n[1]);
      ctx.closePath()
      ctx.strokeStyle = "#000000";
      if (wall.irradiance > 0) {
        ctx.fillStyle = "#EBE54D";
      } else {
        ctx.fillStyle = "#aaaaaa";
      }
      ctx.lineWidth = 3.0;
      ctx.stroke();
      ctx.fill();
    }
  }
  // Intersect returns distance and which wall has been hit
  this.intersect = function(x, d) {
    return [0.0, 0];
  }
  this.trace = function(x, d, first_bounce) {
    // TODO
    return [x, [0,1], 0.0]
  }
  this.irradianceForPoint = function(x, n) {
    // Debug rendering stuff
    var ctx = this.canvas_.getContext("2d");
    this.computeScaleOffset();
    var scale = this.currentScale_;
    var offset = this.currentOffset_;
    var p = [scale[0]*x[0]+offset[0], scale[1]*x[1]+offset[1]];
    ctx.beginPath();
    for (var ray_index = 0; ray_index < this.numHemiRays_; ++ray_index) {
      // Stratified 
      var theta = Math.asin(2.0*(ray_index+Math.random())/this.numHemiRays_-1.0);
      var d = Rotate(n, theta);
      var trace_result = this.trace(x, n, true);
      var y = trace_result[0], n_y = trace_result[1], distance = trace_result[2];
      ctx.moveTo(p[0], p[1]);
      var p_y = [scale[0]*y[0]+offset[0], scale[1]*y[1]+offset[1]];
      ctx.moveTo(p_y[0], p_y[1]);
    }
    ctx.closePath();
    ctx.lineWidth = 1.0;
    ctx.stroke();
    // Compute the irradiance
    return Math.random();
  }
  this.drawIrradianceOnWall = function(wall_idx, num_samples, value_scale) {
    var ctx = this.canvas_.getContext("2d");
    var width = ctx.canvas.width;
    var height = ctx.canvas.height;
    // Fetch scale and offset
    this.computeScaleOffset();
    var scale = this.currentScale_;
    var offset = this.currentOffset_;
    // Sample irradiance at discrete locations on the wall
    var wall = this.walls_[wall_idx];
    var length = wall.line.length()
    var step = length / num_samples;
    var sample_irradiances= [];
    var max_irradiance = 0;
    for (var sample = 0; sample < num_samples; ++sample) {
      var position = step / 2.0 + step * sample;
      var p = wall.line.locationForParameter(position);
      var n = wall.line.normal();
      var irradiance = this.irradianceForPoint(p, n);
      max_irradiance = Math.max(irradiance, max_irradiance);
      sample_irradiances.push(irradiance);
    }
    // Draw the irradiances
    ctx.strokeStyle = "#FF0000";
    ctx.lineWidth = 3.0;
    ctx.beginPath()
    for (var sample = 0; sample < num_samples; ++sample) {
      var position = step / 2.0 + step * sample;
      var p = wall.line.locationForParameter(position);
      p = [scale[0]*p[0]+offset[0], scale[1]*p[1]+offset[1]];
      var n = wall.line.normal();
      position += step;
      var s = value_scale * sample_irradiances[sample] / max_irradiance + kWallWidth;
      var x = [p[0] + n[0] * s, p[1] + n[1] * s];
      if (sample == 0) {
        ctx.moveTo(x[0], x[1]);
      } else {
        ctx.lineTo(x[0], x[1]);
      }
    }
    ctx.stroke();
    ctx.closePath();
  }
}
