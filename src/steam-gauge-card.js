const STEAM_GAUGE_CARD_VERSION = "0.2";

class SteamGaugeCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
	this._resizeObserver = null;	
  }

	connectedCallback() {
	  // Reflow the odometer when container-query sizes change (e.g., devtools open/close)
	  if (!this._resizeObserver) {
		this._resizeObserver = new ResizeObserver(() => this._reflowFlipDisplay());
	  }

	  // Observe the gauge container once it exists
	  const container = this.shadowRoot?.querySelector('.gauge-container');
	  if (container) this._resizeObserver.observe(container);
	}

	disconnectedCallback() {
	  if (this._resizeObserver) {
		this._resizeObserver.disconnect();
	  }
	}

	_reflowFlipDisplay() {
	  const flipDisplay = this.shadowRoot?.getElementById('flipDisplay');
	  if (!flipDisplay || !this.config) return;

	  const raw = flipDisplay.dataset.numericValue;
	  if (raw === undefined || raw === null || raw === '') return;

	  const value = parseFloat(raw);
	  if (Number.isNaN(value)) return;

	  const decimals = this.config.decimals !== undefined ? this.config.decimals : 0;
	  const unit = this.config.unit || '';

	  // IMPORTANT: render directly (no animation) so resize doesn't "spin" the odometer
	  this.renderRotaryDisplay(flipDisplay, value.toFixed(decimals), unit, null);
	}

  setConfig(config) {
    if (!config.entity) {
      throw new Error('You need to define an entity');
    }
    this.config = config;
    this._uniqueId = Math.random().toString(36).substr(2, 9);
    this.render();
	if (this._hass) {
	requestAnimationFrame(() => this.updateGauge());
	}
	
  }

  set hass(hass) {
    this._hass = hass;
	if (!this.config) return;         
	if (!this.shadowRoot) return;	
    this.updateGauge();
  }

  render() {
    const config = this.config;
    const title = config.title || '';
    const min = config.min !== undefined ? config.min : 0;
    const max = config.max !== undefined ? config.max : 100;
    const unit = config.unit || '';
    const uid = this._uniqueId;
    const animationDuration = config.animation_duration !== undefined ? config.animation_duration : 1.2;
    const titleFontSize = config.title_font_size !== undefined ? config.title_font_size : 12;
    const odometerFontSize = config.odometer_font_size !== undefined ? config.odometer_font_size : 2.5;
    const odometerVerticalPosition = config.odometer_vertical_position !== undefined ? config.odometer_vertical_position : 120;
    
    // Angle configuration (0 = top, clockwise)
    // Convert from 0=top to SVG coordinate system where 0=right
    const startAngleDeg = config.start_angle !== undefined ? config.start_angle : 200;
    const endAngleDeg = config.end_angle !== undefined ? config.end_angle : 160;
    // Convert to SVG coordinates (subtract 90 because SVG 0° is right, we want 0° to be top)
    this._startAngle = startAngleDeg - 90;
    this._endAngle = endAngleDeg - 90;
    this._animationDuration = animationDuration;
    
    // Default segments if not specified
    const segments = config.segments || [
      { from: 0, to: 33, color: '#4CAF50' },
      { from: 33, to: 66, color: '#FFC107' },
      { from: 66, to: 100, color: '#F44336' }
    ];

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          padding: 0px;
        }
        .card {
          background: transparent;
          border-radius: 8px;
          padding: 20px;
          box-shadow: none;
          border: none;
          position: relative;
        }
        .card::before {
          display: none;
        }
        .title {
          text-align: center;
          font-size: 18px;
          font-weight: bold;
          color: #3e2723;
          margin-bottom: 10px;
          font-family: 'Georgia', serif;
          text-shadow: 1px 1px 2px rgba(255,255,255,0.5);
        }
        .gauge-container {
          position: relative;
          width: 100%;
          max-width: 400px;
          margin: 0 auto;
          container-type: inline-size;
        }
        .gauge-svg {
          width: 100%;
          height: auto;
          filter: drop-shadow(2px 2px 3px rgba(0,0,0,0.3));
        }
        .value-display {
          display: flex;
          flex-direction: column;
          gap: min(${odometerFontSize * 0.4}px, ${odometerFontSize * 0.1}cqi);
          justify-content: flex-start;
          align-items: center;
          pointer-events: none;
          width: 200px;
          height: 200px;
          padding-top: ${odometerVerticalPosition}px;
        }
        .digits-row {
          display: flex;
          gap: min(${odometerFontSize * 0.4}px, ${odometerFontSize * 0.1}cqi);
          justify-content: center;
          align-items: center;
        }
        .flip-digit {
          background: linear-gradient(180deg, #2a2a2a 0%, #1a1a1a 50%, #0a0a0a 100%);
          color: #f0f0f0;
          font-family: 'Courier New', monospace;
          font-size: clamp(${odometerFontSize * 2}px, ${odometerFontSize}cqi, ${odometerFontSize * 4}px);
          font-weight: bold;
          width: clamp(${odometerFontSize * 1.8}px, ${odometerFontSize * 0.9}cqi, ${odometerFontSize * 3.6}px);
          height: clamp(${odometerFontSize * 2.8}px, ${odometerFontSize * 1.4}cqi, ${odometerFontSize * 5.6}px);
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: clamp(${odometerFontSize * 0.3}px, ${odometerFontSize * 0.15}cqi, ${odometerFontSize * 0.6}px);
          box-shadow: 
            inset 0 1px 2px rgba(255,255,255,0.2),
            inset 0 -1px 2px rgba(0,0,0,0.5),
            0 2px 4px rgba(0,0,0,0.4);
          border: 1px solid #3a3a3a;
          position: relative;
          overflow: hidden;
        }
        .flip-digit::before {
          content: '';
          position: absolute;
          top: 50%;
          left: 0;
          right: 0;
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(0,0,0,0.6), transparent);
          box-shadow: 0 0 2px rgba(0,0,0,0.8);
        }
        .flip-digit.decimal {
          width: clamp(${odometerFontSize * 0.8}px, ${odometerFontSize * 0.4}cqi, ${odometerFontSize * 1.6}px);
          background: transparent;
          box-shadow: none;
          border: none;
        }
        .flip-digit.minus-sign {
          width: clamp(${odometerFontSize * 1.8}px, ${odometerFontSize * 0.9}cqi, ${odometerFontSize * 3.6}px);
          background: transparent;
          box-shadow: none;
          border: none;
          color: #f0f0f0;
        }
        .flip-digit.unit {
          background: transparent;
          color: #2c1810;
          font-family: 'Georgia', serif;
          font-size: clamp(${odometerFontSize * 1.6}px, ${odometerFontSize * 0.8}cqi, ${odometerFontSize * 3.2}px);
          width: auto;
          height: auto;
          box-shadow: none;
          border: none;
          text-shadow: 1px 1px 2px rgba(255,255,255,0.5);
        }
        .flip-digit.unit::before {
          display: none;
        }
        .flip-digit-inner {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          transition: transform ${animationDuration}s ease-out;
        }
        .digit-item {
          width: 100%;
          height: clamp(${odometerFontSize * 2.8}px, ${odometerFontSize * 1.4}cqi, ${odometerFontSize * 5.6}px);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .rivet {
          fill: #6d5d4b;
          filter: drop-shadow(1px 1px 1px rgba(0,0,0,0.4));
        }
        .screw-detail {
          stroke: #4a4034;
          stroke-width: 0.5;
          fill: none;
        }
      </style>
      <ha-card>
        <div class="card">
          <div class="gauge-container">
            <svg class="gauge-svg" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <!-- Gradient for gauge face -->
                <radialGradient id="gaugeFace-${uid}" cx="50%" cy="50%">
                  <stop offset="0%" style="stop-color:#ffffff;stop-opacity:1" />
                  <stop offset="85%" style="stop-color:#f8f8f0;stop-opacity:1" />
                  <stop offset="100%" style="stop-color:#d4d4c8;stop-opacity:1" />
                </radialGradient>
                
                <!-- Gradient for brass rim -->
                <linearGradient id="brassRim-${uid}" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" style="stop-color:#c9a961;stop-opacity:1" />
                  <stop offset="25%" style="stop-color:#ddc68f;stop-opacity:1" />
                  <stop offset="50%" style="stop-color:#b8944d;stop-opacity:1" />
                  <stop offset="75%" style="stop-color:#d4b877;stop-opacity:1" />
                  <stop offset="100%" style="stop-color:#a68038;stop-opacity:1" />
                </linearGradient>
                
                <!-- Shadow filter -->
                <filter id="innerShadow-${uid}">
                  <feGaussianBlur in="SourceAlpha" stdDeviation="2"/>
                  <feOffset dx="1" dy="1" result="offsetblur"/>
                  <feComponentTransfer>
                    <feFuncA type="linear" slope="0.5"/>
                  </feComponentTransfer>
                  <feMerge>
                    <feMergeNode/>
                    <feMergeNode in="SourceGraphic"/>
                  </feMerge>
                </filter>
                
                <!-- Aged texture -->
                <filter id="aged-${uid}">
                  <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="4" result="noise"/>
                  <feColorMatrix in="noise" type="matrix" values="0 0 0 0 0, 0 0 0 0 0, 0 0 0 0 0, 0 0 0 0.03 0"/>
                  <feBlend in="SourceGraphic" in2="noise" mode="multiply"/>
                </filter>
              </defs>
              
              <!-- Outer brass rim -->
              <circle cx="100" cy="100" r="95" fill="url(#brassRim-${uid})" stroke="#8B7355" stroke-width="2"/>
              
              <!-- Inner rim shadow -->
              <circle cx="100" cy="100" r="88" fill="none" stroke="rgba(0,0,0,0.3)" stroke-width="3"/>
              
              <!-- Gauge face -->
              <circle cx="100" cy="100" r="85" fill="url(#gaugeFace-${uid})" filter="url(#aged-${uid})"/>
              
              <!-- Glass effect overlay -->
              <ellipse cx="100" cy="80" rx="60" ry="50" fill="white" opacity="0.15"/>
              
              <!-- Segment arcs -->
              <g id="segments"></g>
              
              <!-- Tick marks -->
              <g id="ticks"></g>
              
              <!-- Numbers -->
              <g id="numbers"></g>
              
              <!-- Title text -->
              ${title ? this.renderTitleText(title, titleFontSize) : ''}
              
              <!-- Center hub background -->
              <circle cx="100" cy="100" r="12" fill="url(#brassRim-${uid})" stroke="#6d5d4b" stroke-width="1"/>
              <circle cx="100" cy="100" r="8" fill="#4a4034" opacity="0.6"/>
              
              <!-- Odometer embedded in SVG (rendered before needle) -->
              <foreignObject x="0" y="0" width="200" height="200">
                <div xmlns="http://www.w3.org/1999/xhtml" class="value-display" id="flipDisplay"></div>
              </foreignObject>
              
              <!-- Needle (rendered after odometer so it's on top) -->
              <g id="needle" style="transform-origin: 100px 100px; transition: transform ${animationDuration}s ease-out;">
                <!-- Needle shadow -->
                <path d="M 100 100 L 95 95 L 97 30 L 100 25 L 103 30 L 105 95 Z" 
                      fill="rgba(0,0,0,0.3)" 
                      transform="translate(2,2)"/>
                <!-- Needle body -->
                <path d="M 100 100 L 95 95 L 97 30 L 100 25 L 103 30 L 105 95 Z" 
                      fill="#C41E3A" 
                      stroke="#8B0000" 
                      stroke-width="0.5"/>
                <!-- Needle highlight -->
                <path d="M 100 100 L 98 95 L 99 30 L 100 25 L 99.5 30 Z" 
                      fill="rgba(255,255,255,0.3)"/>
              </g>
              
              <!-- Needle stoppers -->
              <g id="stoppers"></g>
              
              <!-- Center rivet (on top of needle) -->
              <circle cx="100" cy="100" r="5" class="rivet"/>
              <circle cx="100" cy="100" r="3.5" class="screw-detail"/>
              <line x1="97" y1="100" x2="103" y2="100" class="screw-detail"/>
              
              <!-- Corner rivets -->
              <!-- Top left -->
              <circle cx="20" cy="20" r="4" class="rivet"/>
              <circle cx="20" cy="20" r="2.5" class="screw-detail"/>
              <line x1="17" y1="20" x2="23" y2="20" class="screw-detail"/>
              
              <!-- Top right -->
              <circle cx="180" cy="20" r="4" class="rivet"/>
              <circle cx="180" cy="20" r="2.5" class="screw-detail"/>
              <line x1="177" y1="20" x2="183" y2="20" class="screw-detail"/>
              
              <!-- Bottom left -->
              <circle cx="20" cy="180" r="4" class="rivet"/>
              <circle cx="20" cy="180" r="2.5" class="screw-detail"/>
              <line x1="17" y1="180" x2="23" y2="180" class="screw-detail"/>
              
              <!-- Bottom right -->
              <circle cx="180" cy="180" r="4" class="rivet"/>
              <circle cx="180" cy="180" r="2.5" class="screw-detail"/>
              <line x1="177" y1="180" x2="183" y2="180" class="screw-detail"/>
              
              <!-- Age spots and wear marks -->
              <circle cx="45" cy="60" r="2" fill="#8B7355" opacity="0.2"/>
              <circle cx="155" cy="75" r="1.5" fill="#8B7355" opacity="0.15"/>
              <circle cx="70" cy="120" r="1" fill="#6d5d4b" opacity="0.2"/>
              <ellipse cx="130" cy="50" rx="3" ry="1.5" fill="#8B7355" opacity="0.1"/>
            </svg>
          </div>
        </div>
      </ha-card>
    `;

    this.drawSegments(segments, min, max);
    this.drawTicks(min, max);
    this.drawStoppers();
	if (this._resizeObserver) {
		this._resizeObserver.disconnect();
		const container = this.shadowRoot?.querySelector('.gauge-container');
		if (container) this._resizeObserver.observe(container);
		}
		
	// One extra reflow on next frame so container-query sizes settle
	requestAnimationFrame(() => this._reflowFlipDisplay());	
  }

  renderTitleText(title, fontSize) {
    // Split title by newlines - handle both literal \n typed in input and actual newlines
    const lines = title.replace(/\\n/g, '\n').split('\n').slice(0, 3); // Max 3 lines
    const lineHeight = fontSize * 1.2; // 20% spacing between lines
    const totalHeight = (lines.length - 1) * lineHeight;
    const startY = 75 - (totalHeight / 2); // Center vertically around y=75
    
    return lines.map((line, index) => {
      const y = startY + (index * lineHeight);
      return `<text x="100" y="${y}" text-anchor="middle" font-size="${fontSize}" font-weight="bold" fill="#3e2723" font-family="Georgia, serif" style="text-shadow: 1px 1px 2px rgba(255,255,255,0.5);">${line}</text>`;
    }).join('\n');
  }

  drawSegments(segments, min, max) {
    const segmentsGroup = this.shadowRoot.getElementById('segments');
    const centerX = 100;
    const centerY = 100;
    const radius = 70;
    const startAngle = this._startAngle;
    const endAngle = this._endAngle;
    // Handle wrapping around 360 degrees
    const totalAngle = endAngle >= startAngle ? endAngle - startAngle : (360 - startAngle) + endAngle;

    segments.forEach(segment => {
      const fromPercent = ((segment.from - min) / (max - min)) * 100;
      const toPercent = ((segment.to - min) / (max - min)) * 100;
      
      const segmentStartAngle = startAngle + (totalAngle * fromPercent / 100);
      const segmentEndAngle = startAngle + (totalAngle * toPercent / 100);
      
      const path = this.describeArc(centerX, centerY, radius, segmentStartAngle, segmentEndAngle);
      
      const pathElement = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      pathElement.setAttribute('d', path);
      pathElement.setAttribute('fill', 'none');
      pathElement.setAttribute('stroke', segment.color);
      pathElement.setAttribute('stroke-width', '8');
      pathElement.setAttribute('opacity', '0.7');
      
      segmentsGroup.appendChild(pathElement);
    });
  }

  drawTicks(min, max) {
    const ticksGroup = this.shadowRoot.getElementById('ticks');
    const numbersGroup = this.shadowRoot.getElementById('numbers');
    const centerX = 100;
    const centerY = 100;
    const startAngle = this._startAngle;
    const endAngle = this._endAngle;
    // Handle wrapping around 360 degrees
    const totalAngle = endAngle >= startAngle ? endAngle - startAngle : (360 - startAngle) + endAngle;
    const numTicks = 10;
    
    // Clear any existing ticks and numbers
    ticksGroup.innerHTML = '';
    numbersGroup.innerHTML = '';

    for (let i = 0; i <= numTicks; i++) {
      let angle = startAngle + (totalAngle * i / numTicks);
      // Normalize angle to -180 to 180 range for proper rendering
      while (angle > 180) angle -= 360;
      while (angle < -180) angle += 360;
      const angleRad = (angle * Math.PI) / 180;
      
      // Major tick
      const innerRadius = 77;
      const outerRadius = 85;
      
      const x1 = centerX + innerRadius * Math.cos(angleRad);
      const y1 = centerY + innerRadius * Math.sin(angleRad);
      const x2 = centerX + outerRadius * Math.cos(angleRad);
      const y2 = centerY + outerRadius * Math.sin(angleRad);
      
      const tick = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      tick.setAttribute('x1', x1);
      tick.setAttribute('y1', y1);
      tick.setAttribute('x2', x2);
      tick.setAttribute('y2', y2);
      tick.setAttribute('stroke', '#3e2723');
      tick.setAttribute('stroke-width', '2');
      ticksGroup.appendChild(tick);
      
      // Numbers
      const value = min + ((max - min) * i / numTicks);
      const textRadius = 65;
      const textX = centerX + textRadius * Math.cos(angleRad);
      const textY = centerY + textRadius * Math.sin(angleRad);
      
      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('x', textX);
      text.setAttribute('y', textY);
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('dominant-baseline', 'middle');
      text.setAttribute('font-size', '9');
      text.setAttribute('font-weight', 'bold');
      text.setAttribute('fill', '#3e2723');
      text.setAttribute('font-family', 'Georgia, serif');
      const displayValue = (max - min) <= 10 ? value.toFixed(1) : Math.round(value);
      text.textContent = displayValue;
      numbersGroup.appendChild(text);
      
      // Minor ticks
      if (i < numTicks) {
        for (let j = 1; j < 5; j++) {
          const minorAngle = angle + (totalAngle / numTicks) * (j / 5);
          const minorAngleRad = (minorAngle * Math.PI) / 180;
          
          const mx1 = centerX + 80 * Math.cos(minorAngleRad);
          const my1 = centerY + 80 * Math.sin(minorAngleRad);
          const mx2 = centerX + 85 * Math.cos(minorAngleRad);
          const my2 = centerY + 85 * Math.sin(minorAngleRad);
          
          const minorTick = document.createElementNS('http://www.w3.org/2000/svg', 'line');
          minorTick.setAttribute('x1', mx1);
          minorTick.setAttribute('y1', my1);
          minorTick.setAttribute('x2', mx2);
          minorTick.setAttribute('y2', my2);
          minorTick.setAttribute('stroke', '#5d4e37');
          minorTick.setAttribute('stroke-width', '1');
          ticksGroup.appendChild(minorTick);
        }
      }
    }
  }

  drawStoppers() {
    const stoppersGroup = this.shadowRoot.getElementById('stoppers');
    if (!stoppersGroup) return;
    
    const centerX = 100;
    const centerY = 100;
    const startAngle = this._startAngle;
    const endAngle = this._endAngle;
    
    // Draw stopper at start angle (min value)
    const startAngleRad = (startAngle * Math.PI) / 180;
    const startX = centerX + 75 * Math.cos(startAngleRad);
    const startY = centerY + 75 * Math.sin(startAngleRad);
    
    const startStopper = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    startStopper.setAttribute('cx', startX);
    startStopper.setAttribute('cy', startY);
    startStopper.setAttribute('r', '3');
    startStopper.setAttribute('fill', '#8B0000');
    startStopper.setAttribute('stroke', '#4a4034');
    startStopper.setAttribute('stroke-width', '0.5');
    stoppersGroup.appendChild(startStopper);
    
    // Draw stopper at end angle (max value)
    const endAngleRad = (endAngle * Math.PI) / 180;
    const endX = centerX + 75 * Math.cos(endAngleRad);
    const endY = centerY + 75 * Math.sin(endAngleRad);
    
    const endStopper = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    endStopper.setAttribute('cx', endX);
    endStopper.setAttribute('cy', endY);
    endStopper.setAttribute('r', '3');
    endStopper.setAttribute('fill', '#8B0000');
    endStopper.setAttribute('stroke', '#4a4034');
    endStopper.setAttribute('stroke-width', '0.5');
    stoppersGroup.appendChild(endStopper);
  }

  describeArc(x, y, radius, startAngle, endAngle) {
    const start = this.polarToCartesian(x, y, radius, endAngle);
    const end = this.polarToCartesian(x, y, radius, startAngle);
    const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
    
    return [
      "M", start.x, start.y,
      "A", radius, radius, 0, largeArcFlag, 0, end.x, end.y
    ].join(" ");
  }

  polarToCartesian(centerX, centerY, radius, angleInDegrees) {
    const angleInRadians = (angleInDegrees * Math.PI) / 180.0;
    return {
      x: centerX + (radius * Math.cos(angleInRadians)),
      y: centerY + (radius * Math.sin(angleInRadians))
    };
  }

  updateGauge() {
    if (!this._hass || !this.config) return;
    
    const entity = this._hass.states[this.config.entity];
    if (!entity) return;
    
    const value = parseFloat(entity.state);
    const min = this.config.min !== undefined ? this.config.min : 0;
    const max = this.config.max !== undefined ? this.config.max : 100;
    
    // Update flip display
    this.updateFlipDisplay(value);
    
    if (!isNaN(value)) {
      // Calculate the position of the value within the min-max range
      const range = max - min;
      const clampedValue = Math.max(min, Math.min(max, value));
      const valuePosition = Math.max(0, Math.min(1, (clampedValue - min) / range));
      
      // Use configured start and end angles
      const startAngle = this._startAngle;
      const endAngle = this._endAngle;
      // Handle wrapping around 360 degrees
      const totalAngle = endAngle >= startAngle ? endAngle - startAngle : (360 - startAngle) + endAngle;
      
      // Calculate gauge angle - always interpolate along the valid arc
      // to prevent needle from crossing the dead zone
      let gaugeAngle = startAngle + (totalAngle * valuePosition);
      
      // Normalize the calculated angle to -180 to 180 range first
      while (gaugeAngle > 180) gaugeAngle -= 360;
      while (gaugeAngle < -180) gaugeAngle += 360;
      
      // Now clamp to start/end angles, preventing crossing the dead zone
      if (endAngle >= startAngle) {
        // Normal range (no wrap) - simple clamping
        gaugeAngle = Math.max(startAngle, Math.min(endAngle, gaugeAngle));
      } else {
        // Wrapping range (crosses 0°)
        // Normalize start and end angles for comparison
        let normStart = startAngle;
        let normEnd = endAngle;
        while (normStart > 180) normStart -= 360;
        while (normStart < -180) normStart += 360;
        while (normEnd > 180) normEnd -= 360;
        while (normEnd < -180) normEnd += 360;
        
        // Check if needle is in the dead zone (between end and start)
        // Dead zone is from endAngle (moving clockwise) to startAngle
        const inDeadZone = normEnd < normStart ? 
          (gaugeAngle > normEnd && gaugeAngle < normStart) :
          (gaugeAngle > normEnd || gaugeAngle < normStart);
        
        if (inDeadZone) {
          // Clamp to nearest boundary without crossing dead zone
          const distToStart = Math.min(
            Math.abs(gaugeAngle - normStart),
            Math.abs(gaugeAngle - normStart + 360),
            Math.abs(gaugeAngle - normStart - 360)
          );
          const distToEnd = Math.min(
            Math.abs(gaugeAngle - normEnd),
            Math.abs(gaugeAngle - normEnd + 360),
            Math.abs(gaugeAngle - normEnd - 360)
          );
          gaugeAngle = distToStart < distToEnd ? normStart : normEnd;
        }
      }
      
      // The needle SVG is drawn pointing UP (-90° in standard SVG coords)
      // So we need to add 90° to compensate
      const needleAngle = gaugeAngle + 90;
      
      const needle = this.shadowRoot.getElementById('needle');
      if (needle) {
        needle.style.transform = `rotate(${needleAngle}deg)`;
      }
    }
  }

  updateFlipDisplay(value) {
    const flipDisplay = this.shadowRoot.getElementById('flipDisplay');
    if (!flipDisplay) return;
    
    const decimals = this.config.decimals !== undefined ? this.config.decimals : 0;
    const unit = this.config.unit || '';
    
    let displayText = isNaN(value) ? '--' : value.toFixed(decimals);
    const oldText = flipDisplay.dataset.value || '';
    
    if (displayText === oldText) return; // No change
    
    // Check if this is the first update (no previous value stored)
    const isFirstUpdate = !flipDisplay.dataset.numericValue;
    
    // Store previous numeric value for animation
    const prevValue = flipDisplay.dataset.numericValue ? parseFloat(flipDisplay.dataset.numericValue) : value;
    flipDisplay.dataset.numericValue = value;
    flipDisplay.dataset.value = displayText;
    
    // On first update, render directly without animation to avoid glitches
    if (isFirstUpdate) {
      this.renderRotaryDisplay(flipDisplay, value.toFixed(decimals), unit, null);
    } else {
      // Animate through intermediate values like a real odometer
      this.animateOdometer(flipDisplay, prevValue, value, decimals, unit);
    }
  }

  animateOdometer(flipDisplay, fromValue, toValue, decimals, unit) {
    // Cancel any existing animation
    if (this._odometerAnimation) {
      clearInterval(this._odometerAnimation);
    }

    const diff = Math.abs(toValue - fromValue);
    const steps = Math.min(Math.ceil(diff), 20); // Max 20 steps for smooth animation
    
    if (steps <= 1 || diff === 0) {
      // Small change or no change, just render directly
      this.renderRotaryDisplay(flipDisplay, toValue.toFixed(decimals), unit, null);
      return;
    }

    const increment = (toValue - fromValue) / steps;
    const duration = this._animationDuration || 1.2;
    const stepDuration = (duration * 1000) / steps;
    
    let currentStep = 0;
    let currentValue = fromValue;

    this._odometerAnimation = setInterval(() => {
      currentStep++;
      currentValue += increment;
      
      if (currentStep >= steps) {
        clearInterval(this._odometerAnimation);
        this._odometerAnimation = null;
        currentValue = toValue; // Ensure we end at exact value
      }
      
      this.renderRotaryDisplay(flipDisplay, currentValue.toFixed(decimals), unit, fromValue);
    }, stepDuration);
  }

  renderRotaryDisplay(flipDisplay, displayText, unit, previousValue) {
    const chars = displayText.split('');
    
    // Get or create digits row wrapper
    let digitsRow = flipDisplay.querySelector('.digits-row');
    if (!digitsRow) {
      flipDisplay.innerHTML = '';
      digitsRow = document.createElement('div');
      digitsRow.className = 'digits-row';
      flipDisplay.appendChild(digitsRow);
    }
    
    // Get existing digits or create new structure
    const existingDigits = Array.from(digitsRow.children);
    
    // Clear if structure changed
    if (existingDigits.length !== chars.filter(c => c !== '.').length + chars.filter(c => c === '.').length) {
      digitsRow.innerHTML = '';
      existingDigits.length = 0;
    }
    
    let digitIndex = 0;
    chars.forEach((char, charIndex) => {
      if (char === '.') {
        let decimalEl = existingDigits[digitIndex];
        if (!decimalEl || !decimalEl.classList.contains('decimal')) {
          decimalEl = document.createElement('div');
          decimalEl.className = 'flip-digit decimal';
          decimalEl.textContent = char;
          if (digitIndex < digitsRow.children.length) {
            digitsRow.insertBefore(decimalEl, digitsRow.children[digitIndex]);
          } else {
            digitsRow.appendChild(decimalEl);
          }
        }
        digitIndex++;
      } else if (char === '-') {
        // Handle minus sign as a static display element
        let minusEl = existingDigits[digitIndex];
        if (!minusEl || !minusEl.classList.contains('minus-sign')) {
          minusEl = document.createElement('div');
          minusEl.className = 'flip-digit minus-sign';
          minusEl.textContent = char;
          if (digitIndex < digitsRow.children.length) {
            digitsRow.insertBefore(minusEl, digitsRow.children[digitIndex]);
          } else {
            digitsRow.appendChild(minusEl);
          }
        }
        digitIndex++;
      } else {
        let digitEl = existingDigits[digitIndex];
        if (!digitEl || digitEl.classList.contains('decimal') || digitEl.classList.contains('minus-sign')) {
          // Create new rotary digit with extended range for smooth rolling
          digitEl = document.createElement('div');
          digitEl.className = 'flip-digit';
          const inner = document.createElement('div');
          inner.className = 'flip-digit-inner';
          
          // Create multiple cycles of digits for smooth forward rolling
          // This allows us to always animate forward without jumping back
          const baseDigits = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
          // Repeat the digit sequence 3 times to allow for forward wrapping
          for (let cycle = 0; cycle < 3; cycle++) {
            baseDigits.forEach(d => {
              const item = document.createElement('div');
              item.className = 'digit-item';
              item.textContent = d;
              inner.appendChild(item);
            });
          }
          
          digitEl.appendChild(inner);
          digitEl.dataset.currentCycle = '1'; // Track which cycle we're on
          if (digitIndex < digitsRow.children.length) {
            digitsRow.insertBefore(digitEl, digitsRow.children[digitIndex]);
          } else {
            digitsRow.appendChild(digitEl);
          }
        }
        
        // Update rotation position with forward-only animation
        const inner = digitEl.querySelector('.flip-digit-inner');
        if (inner) {
          const targetDigit = parseInt(char);
          
          // Check if this is initial setup (no position set yet)
          const isInitialSetup = !digitEl.dataset.position;
          
          if (isInitialSetup) {
            // On initial setup, position without animation
            digitEl.dataset.currentCycle = '1';
            const newPosition = targetDigit + 10; // Start at second cycle for initial position
            digitEl.dataset.position = targetDigit.toString();
            
            // Disable transition for initial positioning
            inner.style.transition = 'none';
            
            // Wait for DOM to render before measuring and positioning
            requestAnimationFrame(() => {
              // Force a reflow to ensure elements are rendered
              inner.offsetHeight;
              
              // Now measure the actual height
              const digitItem = inner.querySelector('.digit-item');
              const digitHeight = digitItem ? digitItem.offsetHeight : 28;
              const offset = -newPosition * digitHeight;
              
              inner.style.transform = `translateY(${offset}px)`;
              
              // Re-enable transition after another frame
              requestAnimationFrame(() => {
                inner.style.transition = '';
              });
            });
          } else {
            // Get previous position to determine rotation direction
            const prevPosition = parseFloat(digitEl.dataset.position || targetDigit);
            const currentCycle = parseInt(digitEl.dataset.currentCycle || 1);
            
            // Calculate new position ensuring forward rotation
            let newPosition = targetDigit;
            
            // Normal animated update
            // If going backwards (e.g., 9 to 0), move to next cycle
            if (targetDigit < prevPosition && prevPosition - targetDigit > 5) {
              // This is likely a rollover (9->0), advance to next cycle
              const nextCycle = currentCycle + 1;
              if (nextCycle > 2) {
                // Reset to first cycle
                digitEl.dataset.currentCycle = '0';
                newPosition = targetDigit;
              } else {
                digitEl.dataset.currentCycle = nextCycle.toString();
                newPosition = targetDigit + (nextCycle * 10); // 10 digits per cycle
              }
            } else {
              // Normal forward movement or same digit
              newPosition = targetDigit + (currentCycle * 10);
            }
            
            digitEl.dataset.position = targetDigit.toString();
            
            // Calculate digit height dynamically based on container size
            const digitItem = inner.querySelector('.digit-item');
            const digitHeight = digitItem ? digitItem.offsetHeight : 28;
            const offset = -newPosition * digitHeight;
            inner.style.transform = `translateY(${offset}px)`;
          }
        }
        
        digitIndex++;
      }
    });
    
    // Add unit if present
    const existingUnit = flipDisplay.querySelector('.flip-digit.unit');
    if (unit) {
      if (!existingUnit) {
        const unitSpan = document.createElement('div');
        unitSpan.className = 'flip-digit unit';
        unitSpan.textContent = unit;
        flipDisplay.appendChild(unitSpan);
      } else {
        existingUnit.textContent = unit;
      }
    } else if (existingUnit) {
      existingUnit.remove();
    }
  }

  getCardSize() {
    return 4;
  }

  static get supportsCardResize() {
    return true;
  }

  static getConfigElement() {
    return document.createElement('steam-gauge-card-editor');
  }

  static getStubConfig() {
    return {
      entity: '',
      title: 'Gauge',
      title_font_size: 12,
      odometer_font_size: 2.5,
      odometer_vertical_position: 120,
      min: 0,
      max: 100,
      unit: '',
      decimals: 0,
      start_angle: 200,
      end_angle: 160,
      animation_duration: 1.2,
      segments: [
        { from: 0, to: 33, color: '#4CAF50' },
        { from: 33, to: 66, color: '#FFC107' },
        { from: 66, to: 100, color: '#F44336' }
      ]
    };
  }
}

// Card Editor
class SteamGaugeCardEditor extends HTMLElement {
  setConfig(config) {
    this._config = config;
    if (!this.innerHTML) {
      this.render();
    }
  }

  set hass(hass) {
    this._hass = hass;
    if (this._config && !this._hass) {
      this.populateEntityDropdown();
    }
    this._hass = hass;
  }

  render() {
    if (!this._config) return;

    this.innerHTML = `
      <style>
        .card-config {
          padding: 16px;
        }
        .config-row {
          display: flex;
          align-items: center;
          margin-bottom: 12px;
        }
        .config-row label {
          flex: 1;
          font-weight: 500;
        }
        .config-row input,
        .config-row select {
          flex: 2;
          padding: 8px;
          border: 1px solid #ccc;
          border-radius: 4px;
        }
        .entity-picker {
          flex: 2;
          position: relative;
          z-index: 100;
        }
        .entity-search {
          width: 100%;
          padding: 8px;
          border: 1px solid #ccc;
          border-radius: 4px;
          box-sizing: border-box;
        }
        .entity-dropdown {
          position: absolute;
          top: 100%;
          left: 0;
          right: 0;
          max-height: 200px;
          overflow-y: auto;
          background: white;
          border: 1px solid #ccc;
          border-top: none;
          border-radius: 0 0 4px 4px;
          box-shadow: 0 4px 6px rgba(0,0,0,0.1);
          display: none;
          z-index: 1000;
        }
        .entity-dropdown.open {
          display: block;
        }
        .entity-option {
          padding: 8px;
          cursor: pointer;
          border-bottom: 1px solid #f0f0f0;
        }
        .entity-option:hover {
          background: #f5f5f5;
        }
        .entity-option.selected {
          background: #e3f2fd;
        }
        .config-section {
          margin-top: 20px;
          padding-top: 16px;
          border-top: 1px solid #e0e0e0;
        }
        .config-section-title {
          font-size: 16px;
          font-weight: 600;
          margin-bottom: 12px;
        }
        .segment-item {
          background: #f5f5f5;
          padding: 12px;
          margin-bottom: 8px;
          border-radius: 4px;
          position: relative;
        }
        .segment-controls {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 8px;
          margin-bottom: 8px;
        }
        .segment-controls label {
          display: block;
          font-size: 12px;
          margin-bottom: 4px;
        }
        .segment-controls input {
          width: 100%;
          padding: 4px;
        }
        .remove-segment {
          position: absolute;
          top: 8px;
          right: 8px;
          background: #f44336;
          color: white;
          border: none;
          border-radius: 50%;
          width: 24px;
          height: 24px;
          cursor: pointer;
          font-size: 16px;
          line-height: 1;
        }
        .add-segment {
          background: #4CAF50;
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
        }
        .add-segment:hover {
          background: #45a049;
        }
      </style>
      <div class="card-config">
        <div class="config-row">
          <label>Entity</label>
          <div class="entity-picker">
            <input type="text" 
                   id="entity-search" 
                   class="entity-search" 
                   placeholder="Search entities..." 
                   autocomplete="off"
                   value="${this._config.entity || ''}">
            <div id="entity-dropdown" class="entity-dropdown"></div>
          </div>
        </div>
        
        <div class="config-row">
          <label>Title</label>
          <input type="text" id="title" value="${this._config.title || ''}" placeholder="Gauge Title (use \\n for newlines)">
        </div>
        
        <div class="config-row">
          <label>Title Font Size</label>
          <input type="number" id="title_font_size" min="6" max="24" value="${this._config.title_font_size !== undefined ? this._config.title_font_size : 12}">
        </div>
        
        <div class="config-row">
          <label>Odometer Size</label>
          <input type="number" id="odometer_font_size" min="1" max="10" step="0.5" value="${this._config.odometer_font_size !== undefined ? this._config.odometer_font_size : 2.5}">
        </div>
        
        <div class="config-row">
          <label>Odometer Vertical Position</label>
          <input type="number" id="odometer_vertical_position" min="50" max="150" step="5" value="${this._config.odometer_vertical_position !== undefined ? this._config.odometer_vertical_position : 120}">
        </div>
        
        <div class="config-row">
          <label>Unit</label>
          <input type="text" id="unit" value="${this._config.unit || ''}" placeholder="e.g., °F, PSI">
        </div>
        
        <div class="config-row">
          <label>Minimum Value</label>
          <input type="number" id="min" value="${this._config.min !== undefined ? this._config.min : 0}">
        </div>
        
        <div class="config-row">
          <label>Maximum Value</label>
          <input type="number" id="max" value="${this._config.max !== undefined ? this._config.max : 100}">
        </div>
        
        <div class="config-row">
          <label>Decimal Places</label>
          <input type="number" id="decimals" min="0" max="3" value="${this._config.decimals !== undefined ? this._config.decimals : 0}">
        </div>
        
        <div class="config-section">
          <div class="config-section-title">Gauge Angles (0° = Top, Clockwise)</div>
          
          <div class="config-row">
            <label>Start Angle (Min)</label>
            <input type="number" id="start_angle" min="0" max="359" value="${this._config.start_angle !== undefined ? this._config.start_angle : 200}">
          </div>
          
          <div class="config-row">
            <label>End Angle (Max)</label>
            <input type="number" id="end_angle" min="0" max="359" value="${this._config.end_angle !== undefined ? this._config.end_angle : 160}">
          </div>
        </div>
        
        <div class="config-section">
          <div class="config-section-title">Animation</div>
          
          <div class="config-row">
            <label>Animation Duration (seconds)</label>
            <input type="number" id="animation_duration" min="0.1" max="5" step="0.1" value="${this._config.animation_duration !== undefined ? this._config.animation_duration : 1.2}">
          </div>
        </div>
        
        <div class="config-section">
          <div class="config-section-title">Color Segments</div>
          <div id="segments-container"></div>
          <button class="add-segment" id="add-segment">+ Add Segment</button>
        </div>
      </div>
    `;

    setTimeout(() => {
      this.populateEntityDropdown();
      this.renderSegments();
      this.attachEventListeners();
    }, 0);
  }

  populateEntityDropdown() {
    const searchInput = this.querySelector('#entity-search');
    const dropdown = this.querySelector('#entity-dropdown');
    if (!this._hass || !searchInput || !dropdown) return;

    // Get all numeric entities
    this._allEntities = Object.keys(this._hass.states)
      .filter(id => id.startsWith('sensor.') || id.startsWith('input_number.'))
      .sort();

    // Setup search input handlers
    searchInput.addEventListener('focus', () => {
      this.filterAndShowEntities('');
    });

    searchInput.addEventListener('input', (e) => {
      this.filterAndShowEntities(e.target.value);
    });

    searchInput.addEventListener('blur', (e) => {
      // Delay to allow click on dropdown item
      setTimeout(() => {
        dropdown.classList.remove('open');
      }, 200);
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
      if (!searchInput.contains(e.target) && !dropdown.contains(e.target)) {
        dropdown.classList.remove('open');
      }
    });
  }

  filterAndShowEntities(searchTerm) {
    const dropdown = this.querySelector('#entity-dropdown');
    if (!dropdown || !this._allEntities) return;

    const term = searchTerm.toLowerCase();
    const filtered = this._allEntities.filter(id => 
      id.toLowerCase().includes(term)
    );

    dropdown.innerHTML = '';
    
    // Limit to 50 results for performance
    const displayEntities = filtered.slice(0, 50);
    
    if (displayEntities.length === 0) {
      const noResults = document.createElement('div');
      noResults.className = 'entity-option';
      noResults.textContent = 'No entities found';
      noResults.style.fontStyle = 'italic';
      noResults.style.color = '#999';
      dropdown.appendChild(noResults);
    } else {
      displayEntities.forEach(entityId => {
        const option = document.createElement('div');
        option.className = 'entity-option';
        if (entityId === this._config.entity) {
          option.classList.add('selected');
        }
        option.textContent = entityId;
        option.addEventListener('click', () => {
          this.selectEntity(entityId);
        });
        dropdown.appendChild(option);
      });
    }

    dropdown.classList.add('open');
  }

  selectEntity(entityId) {
    const searchInput = this.querySelector('#entity-search');
    const dropdown = this.querySelector('#entity-dropdown');
    
    if (searchInput) {
      searchInput.value = entityId;
    }
    if (dropdown) {
      dropdown.classList.remove('open');
    }
    
    this._config = { ...this._config, entity: entityId };
    this.configChanged();
  }

  renderSegments() {
    const container = this.querySelector('#segments-container');
    if (!container) return;

    const segments = this._config.segments || [];
    container.innerHTML = '';

    segments.forEach((segment, index) => {
      const segmentEl = document.createElement('div');
      segmentEl.className = 'segment-item';
      segmentEl.innerHTML = `
        <button class="remove-segment" data-index="${index}">×</button>
        <div class="segment-controls">
          <div>
            <label>From</label>
            <input type="number" class="segment-from" data-index="${index}" value="${segment.from}">
          </div>
          <div>
            <label>To</label>
            <input type="number" class="segment-to" data-index="${index}" value="${segment.to}">
          </div>
          <div>
            <label>Color</label>
            <input type="color" class="segment-color" data-index="${index}" value="${segment.color}">
          </div>
        </div>
      `;
      container.appendChild(segmentEl);
    });
  }

  attachEventListeners() {
    // Remove old listeners if they exist
    if (this._inputHandler) {
      this.removeEventListener('input', this._inputHandler);
    }
    if (this._clickHandler) {
      this.removeEventListener('click', this._clickHandler);
    }

    const inputs = ['title', 'title_font_size', 'odometer_font_size', 'odometer_vertical_position', 'unit', 'min', 'max', 'decimals', 'start_angle', 'end_angle', 'animation_duration'];
    inputs.forEach(id => {
      const input = this.querySelector(`#${id}`);
      if (input) {
        input.addEventListener('input', () => this.configChanged());
      }
    });
    
    // Entity search is handled separately in populateEntityDropdown

    // Store handlers for cleanup
    this._inputHandler = (e) => {
      if (e.target.classList.contains('segment-from') || 
          e.target.classList.contains('segment-to') || 
          e.target.classList.contains('segment-color')) {
        this.updateSegment(e.target);
      }
    };

    this._clickHandler = (e) => {
      if (e.target.classList.contains('remove-segment')) {
        this.removeSegment(parseInt(e.target.dataset.index));
      } else if (e.target.id === 'add-segment') {
        this.addSegment();
      }
    };

    this.addEventListener('input', this._inputHandler);
    this.addEventListener('click', this._clickHandler);
  }

  configChanged() {
    const entityEl = this.querySelector('#entity-search');
    const titleEl = this.querySelector('#title');
    const titleFontSizeEl = this.querySelector('#title_font_size');
    const odometerFontSizeEl = this.querySelector('#odometer_font_size');
    const odometerVerticalPositionEl = this.querySelector('#odometer_vertical_position');
    const unitEl = this.querySelector('#unit');
    const minEl = this.querySelector('#min');
    const maxEl = this.querySelector('#max');
    const decimalsEl = this.querySelector('#decimals');
    const startAngleEl = this.querySelector('#start_angle');
    const endAngleEl = this.querySelector('#end_angle');
    const animDurationEl = this.querySelector('#animation_duration');

    if (!entityEl || !titleEl || !titleFontSizeEl || !odometerFontSizeEl || !odometerVerticalPositionEl || !unitEl || !minEl || !maxEl || !decimalsEl || !startAngleEl || !endAngleEl || !animDurationEl) return;

    const newConfig = {
      ...this._config,
      entity: entityEl.value,
      title: titleEl.value,
      title_font_size: parseInt(titleFontSizeEl.value),
      odometer_font_size: parseFloat(odometerFontSizeEl.value),
      odometer_vertical_position: parseInt(odometerVerticalPositionEl.value),
      unit: unitEl.value,
      min: parseFloat(minEl.value),
      max: parseFloat(maxEl.value),
      decimals: parseInt(decimalsEl.value),
      start_angle: parseInt(startAngleEl.value),
      end_angle: parseInt(endAngleEl.value),
      animation_duration: parseFloat(animDurationEl.value)
    };

    this._config = newConfig;
    this.dispatchEvent(new CustomEvent('config-changed', {
      detail: { config: newConfig },
      bubbles: true,
      composed: true
    }));
  }

  updateSegment(input) {
    const index = parseInt(input.dataset.index);
    const segments = [...(this._config.segments || [])];
    
    if (input.classList.contains('segment-from')) {
      segments[index].from = parseFloat(input.value);
    } else if (input.classList.contains('segment-to')) {
      segments[index].to = parseFloat(input.value);
    } else if (input.classList.contains('segment-color')) {
      segments[index].color = input.value;
    }

    this._config = { ...this._config, segments };
    this.dispatchEvent(new CustomEvent('config-changed', {
      detail: { config: this._config },
      bubbles: true,
      composed: true
    }));
  }

  addSegment() {
    const segments = [...(this._config.segments || [])];
    const lastSegment = segments[segments.length - 1];
    const newFrom = lastSegment ? lastSegment.to : 0;
    const newTo = lastSegment ? lastSegment.to + 10 : 10;
    
    segments.push({
      from: newFrom,
      to: newTo,
      color: '#2196F3'
    });

    this._config = { ...this._config, segments };
    this.renderSegments();
    this.attachEventListeners();
    
    this.dispatchEvent(new CustomEvent('config-changed', {
      detail: { config: this._config },
      bubbles: true,
      composed: true
    }));
  }

  removeSegment(index) {
    const segments = [...(this._config.segments || [])];
    segments.splice(index, 1);

    this._config = { ...this._config, segments };
    this.renderSegments();
    this.attachEventListeners();
    
    this.dispatchEvent(new CustomEvent('config-changed', {
      detail: { config: this._config },
      bubbles: true,
      composed: true
    }));
  }

  static get properties() {
    return {
      hass: {},
      _config: {}
    };
  }
}

customElements.define('steam-gauge-card', SteamGaugeCard);
customElements.define('steam-gauge-card-editor', SteamGaugeCardEditor);
console.info(
  `%cSteam Gauge Card%c v${STEAM_GAUGE_CARD_VERSION}`,
  "color: #03a9f4; font-weight: bold;",
  "color: inherit;"
);
// Register the card with Home Assistant
window.customCards = window.customCards || [];
window.customCards.push({
  type: 'steam-gauge-card',
  name: 'Steam Gauge Card',
  description: 'A vintage steam engine style gauge card'
});
