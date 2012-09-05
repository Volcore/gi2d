kWallWidth = 5.0;
kSceneBorder = 200.0;
kIrradianceColor = "#FF0000";
kIrradianceNoOcclusionGradientColor = "#F5B622";
kIrradianceGradientColor = "#36802D";
kBackgroundColor = "#C3D9FF";
kLightSourceColor = "#EBE54D";
kWallColor = "#aaaaaa";

function Sqr(x) { return x * x; }
function Rotate2(x, angle) {
  var c = Math.cos(angle);
  var s = Math.sin(angle);
  return [c * x[0] - s * x[1], s * x[0] + c * x[1]];
}
function Dot2(x, y) {
  return x[0] * y[0] + x[1] * y[1];
}
function Scale2(s, x) {
  return [s*x[0], s*x[1]];
}
function Add2(x, y) {
  return [x[0] + y[0], x[1] + y[1]];
}
function Sub2(x, y) {
  return [x[0] + y[0], x[1] + y[1]];
}

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
    return Rotate2(this.direction(), Math.PI/2.0)
  }
  this.intersect = function(x, d) {
    var denom = (start[1] - end[1])*d[0] - (start[0] - end[0])*d[1];
    var numa = (start[0] - end[0])*(x[1] - end[1]) - (start[1] - end[1])*(x[0] - end[0]);
    var numb = d[0]*(x[1] - end[1]) - d[1]*(x[0] - end[0]);
    if (denom == 0.0) {
      return -1;
    }
    var ua = numa/denom;
    var ub = numb/denom;
    if (ua > 0.0 && ub >= 0.0 && ub <= 1.0 ) {
      return ua;
    }
    return -1.0;
  }
}

function Wall(line, irradiance, diffuse) {
  this.line = line;
  this.irradiance = irradiance;
  this.diffuse = diffuse;
  this.radiance = function() {
    // Assuming diffuse emission, the irradiance is distributed evenly into all directions
    return this.irradiance / (2.0 * Math.PI);
  }
}

function IrradianceSample(E, dE, dEocc, ddE, ddEocc) {
  this.E = E;
  this.dE = dE;
  this.dEocc = dEocc;
  this.ddE = ddE;
  this.ddEocc = ddEocc;
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
    var border = kSceneBorder*2.0;
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
    ctx.fillStyle = kBackgroundColor;
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
        ctx.fillStyle = kLightSourceColor;
      } else {
        ctx.fillStyle = kWallColor;
      }
      ctx.lineWidth = 3.0;
      ctx.stroke();
      ctx.fill();
    }
  }
  // Intersect returns distance and which wall has been hit
  this.intersect = function(x, d) {
    var min_distance = 1e20;
    var id = -1;
    for (var wall_idx in this.walls_) {
      var wall = this.walls_[wall_idx];
      var distance = wall.line.intersect(x, d);
      if (distance > 0 && distance < min_distance) {
        id = wall_idx;
        min_distance = distance;
      }
    }
    if (id != -1) {
      return [min_distance, id];
    }
    return null;
  }
  this.trace = function(x, d, first_bounce) {
    var intersection = this.intersect(x, d);
    if (intersection == null) {
      return [d, 1e20, 0];
    }
    var distance = intersection[0];
    var wall_idx = intersection[1];
    var wall = this.walls_[wall_idx];
    var n = wall.line.normal();
    // Invert normal if pointing in the other direction
    if (n[0] * d[0] + n[1] * d[1] > 0) {
      n = [-n[0], -n[1]];
    }
    // Compute the radiance
    var radiance = 0.0;
    if (first_bounce) {
      // On first bounce, add direct lighting
      radiance += wall.radiance();
    }
    // TODO(VS): sample the direct lighting from here
    // TODO(VS): round robin termination of path tracing
    return [n, distance, radiance]
  }
  this.irradianceForPoint = function(x, n_x) {
    // Precompute some values
    var tangent = Rotate2(n_x, Math.PI/2);
    // Integrate over the hemisphere
    // Returns an IrradianceSample
    var E = 0.0;
    var dE = [0.0, 0.0];
    var dEocc = [0.0, 0.0];
    var pL = 0.0;  // Previous radiance
    var pR = 1e20;  // Previous radius
    for (var ray_index = 0; ray_index < this.numHemiRays_; ++ray_index) {
      // Stratified sampling
      var theta = Math.asin(2.0*(ray_index+Math.random())/this.numHemiRays_-1.0);
      // Compute the direction of the ray, and path trace it
      var d = Rotate2(n_x, theta);
      var trace_result = this.trace(x, d, true);
      // extract results
      var n_y = trace_result[0];
      var r = trace_result[1];
      var L = trace_result[2];
      var y = [x[0] + d[0] * r, x[1] + d[1] * r];
      // Accumulate the irradiance
      var cosine_theta = Math.cos(theta);
      var probability = cosine_theta/2.0;
      E += L * cosine_theta / probability;
      // Compute occlusion free gradient
      var xy = [d[0] * r, d[1] * r];
      var r2 = r*r;
      var cosine_theta_y = -Dot2(xy, n_y)/r;
      var ga = Scale2(3.0 / r2, xy);
      var gb = Scale2(1.0 / (cosine_theta * r), n_x);
      var gc = Scale2(1.0 / (cosine_theta_y * r), n_y);
      dE = Add2(dE, Scale2(cosine_theta * L / probability, Add2(Sub2(ga, gb), gc)));
      // Compute correct gradient
      var tim = Math.asin(2.0*ray_index/this.numHemiRays_-1.0);
      var ctim = Math.cos(tim);
      var grad_scale = (L - pL) * Sqr(ctim) / Math.min(r, pR);
      dEocc = Add2(dEocc, Scale2(grad_scale, tangent));
      // Store values for this hemicircle stratum
      pL = L;
      pR = r;
      // Debug draw: visualize the incoming radiance along the rays
      if (false) {
        var ctx = this.canvas_.getContext("2d");
        this.computeScaleOffset();
        var scale = this.currentScale_;
        var offset = this.currentOffset_;
        ctx.beginPath();
        var p = [scale[0]*x[0]+offset[0], scale[1]*x[1]+offset[1]];
        ctx.moveTo(p[0], p[1]);
        var p_y = [scale[0]*y[0]+offset[0], scale[1]*y[1]+offset[1]];
        ctx.lineTo(p_y[0], p_y[1]);
        ctx.closePath();
        ctx.lineWidth = 1.0;
        c = Math.floor(radiance*100);
        ctx.strokeStyle = "rgb("+c+","+c+","+c+")";
        ctx.stroke();
      }
    }
    // Normalize
    E /= this.numHemiRays_;
    dE = Scale2(1.0/this.numHemiRays_, dE);
    // return the samples
    return new IrradianceSample(E, dE, dEocc, 0, 0);
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
    var sample_irradiances= [];
    var max_irradiance = 0;
    for (var sample = 0; sample < num_samples; ++sample) {
      var t = sample / num_samples;
      var p = wall.line.locationForParameter(t);
      var n = wall.line.normal();
      var irradiance_sample = this.irradianceForPoint(p, n);
      max_irradiance = Math.max(irradiance_sample.E, max_irradiance);
      sample_irradiances.push(irradiance_sample);
    }
    // Draw the irradiances
    ctx.strokeStyle = kIrradianceColor;
    ctx.lineWidth = 3.0;
    ctx.beginPath()
    for (var sample = 0; sample < num_samples; ++sample) {
      var t = (sample+0.5) / num_samples;
      var p = wall.line.locationForParameter(t);
      p = [scale[0]*p[0]+offset[0], scale[1]*p[1]+offset[1]];
      var n = wall.line.normal();
      var s = value_scale * sample_irradiances[sample].E / max_irradiance + kWallWidth;
      var x = [p[0] + n[0] * s, p[1] + n[1] * s];
      if (sample == 0) {
        ctx.moveTo(x[0], x[1]);
      } else {
        ctx.lineTo(x[0], x[1]);
      }
    }
    ctx.stroke();
    ctx.closePath();
    // Draw the gradient
    ctx.strokeStyle = kIrradianceNoOcclusionGradientColor;
    ctx.lineWidth = 3.0;
    ctx.beginPath()
    for (var sample = 0; sample < num_samples; ++sample) {
      var t = (sample+0.5) / num_samples;
      var p = wall.line.locationForParameter(t);
      p = [scale[0]*p[0]+offset[0], scale[1]*p[1]+offset[1]];
      var n = wall.line.normal();
      var tangent = Rotate2(n, Math.PI/2.0);
      // Evaluate gradient in tangent direction
      var grad = Dot2(tangent, sample_irradiances[sample].dE);
      var s = value_scale * grad / max_irradiance + kWallWidth;
      var x = [p[0] + n[0] * s, p[1] + n[1] * s];
      if (sample == 0) {
        ctx.moveTo(x[0], x[1]);
      } else {
        ctx.lineTo(x[0], x[1]);
      }
    }
    ctx.stroke();
    ctx.closePath();
    // Draw the occlusion gradient
    ctx.strokeStyle = kIrradianceGradientColor;
    ctx.lineWidth = 3.0;
    ctx.beginPath()
    for (var sample = 0; sample < num_samples; ++sample) {
      var t = (sample+0.5) / num_samples;
      var p = wall.line.locationForParameter(t);
      p = [scale[0]*p[0]+offset[0], scale[1]*p[1]+offset[1]];
      var n = wall.line.normal();
      var tangent = Rotate2(n, Math.PI/2.0);
      // Evaluate gradient in tangent direction
      var grad = Dot2(tangent, sample_irradiances[sample].dEocc);
      var s = value_scale * grad / max_irradiance + kWallWidth;
      var x = [p[0] + n[0] * s, p[1] + n[1] * s];
      if (sample == 0) {
        ctx.moveTo(x[0], x[1]);
      } else {
        ctx.lineTo(x[0], x[1]);
      }
    }
    ctx.stroke();
    ctx.closePath();
    // Draw the legend
    if (true) {
      var items = [
        ["Irradiance", kIrradianceColor, false],
        ["Irradiance Gradient (no occlusion)", kIrradianceNoOcclusionGradientColor, false],
        ["Irradiance Gradient (occlusion)", kIrradianceGradientColor, false],
        ["Wall", kWallColor, true],
        ["Light Source", kLightSourceColor, true]
      ];
      var offset = 10;
      // Draw irradiance
      for (var i = 0; i < items.length; ++i) {
        var item = items[i];
        ctx.fillStyle = "#000000";
        ctx.font = "bold 16px Arial";
        ctx.fillText(item[0], 30, height-offset);
        if (item[2]) {
          // Draw a box
          ctx.strokeStyle = "#000000";
          ctx.fillStyle = item[1];
          ctx.beginPath();
          ctx.moveTo(5, height-offset);
          ctx.lineTo(5, height-10-offset);
          ctx.lineTo(25, height-10-offset);
          ctx.lineTo(25, height-offset);
          ctx.lineTo(5, height-offset);
          ctx.stroke();
          ctx.fill();
          ctx.closePath();
        } else {
          // Draw a line
          ctx.strokeStyle = item[1];
          ctx.beginPath();
          ctx.moveTo(5, height-5-offset);
          ctx.lineTo(25, height-5-offset);
          ctx.stroke();
          ctx.closePath();
        }
        offset += 20;
      }
    }
  }
}
