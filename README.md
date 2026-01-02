# Steam Gauge Card for Home Assistant

A custom Lovelace card that displays sensor values as a vintage steam engine gauge with an aged, industrial aesthetic.

## Features

- 🎨 Vintage steam engine aesthetic with aged brass and worn appearance
- 🎯 Animated flip-style digital display (odometer effect)
- 🔴 Red needle with smooth animations
- 🎯 Configurable color segments and ranges
- 📊 Customizable min/max values and angle ranges
- 🔢 Multi-line title support
- 🎭 Embedded SVG graphics (no external dependencies)
- ⚙️ Detailed tick marks and numbers
- ⏱️ Configurable animation speed
- 📏 Adjustable title font size

## Installation

### Manual Installation

1. Copy `steam-gauge-card.js` to your `config/www` folder in Home Assistant
2. Add the resource to your Lovelace configuration:

**Via UI:**
- Go to Settings → Dashboards → Resources tab
- Click "Add Resource"
- URL: `/local/steam-gauge-card.js`
- Resource type: `JavaScript Module`

**Via YAML:**
```yaml
resources:
  - url: /local/steam-gauge-card.js
    type: module
```

## Configuration

### Basic Configuration

```yaml
type: custom:steam-gauge-card
entity: sensor.temperature
title: Boiler Temperature
min: 0
max: 100
unit: "°F"
```

### Advanced Configuration with Custom Segments

```yaml
type: custom:steam-gauge-card
entity: sensor.pressure
title: Steam Pressure
min: 0
max: 150
unit: "PSI"
decimals: 1
animation_duration: 0.8
segments:
  - from: 0
    to: 50
    color: '#4CAF50'  # Green - Safe
  - from: 50
    to: 100
    color: '#FFC107'  # Yellow - Caution
  - from: 100
    to: 150
    color: '#F44336'  # Red - Danger
```

### Custom Angle Range

```yaml
type: custom:steam-gauge-card
entity: sensor.temperature
title: Engine\nTemperature  # Multi-line title
min: 0
max: 200
unit: "°F"
start_angle: 220  # Start further left
end_angle: 140    # End further right
title_font_size: 14
```

## Configuration Options

| Option | Type | Required | Default | Description |
|--------|------|----------|---------|-------------|
| `entity` | string | **Yes** | - | Entity ID to display |
| `title` | string | No | - | Card title (supports multi-line with `\n`) |
| `min` | number | No | 0 | Minimum gauge value |
| `max` | number | No | 100 | Maximum gauge value |
| `unit` | string | No | '' | Unit of measurement |
| `decimals` | number | No | 0 | Number of decimal places to display |
| `segments` | array | No | See below | Color segments configuration |
| `start_angle` | number | No | 200 | Start angle of gauge arc (0 = top, clockwise) |
| `end_angle` | number | No | 160 | End angle of gauge arc (0 = top, clockwise) |
| `animation_duration` | number | No | 1.2 | Animation duration in seconds |
| `title_font_size` | number | No | 12 | Font size for the title text |

### Default Segments

If not specified, the gauge uses these default segments:
```yaml
segments:
  - from: 0
    to: 33
    color: '#4CAF50'  # Green
  - from: 33
    to: 66
    color: '#FFC107'  # Yellow
  - from: 66
    to: 100
    color: '#F44336'  # Red
```

### Segment Options

Each segment in the `segments` array can have:

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `from` | number | **Yes** | Start value of the segment |
| `to` | number | **Yes** | End value of the segment |
| `color` | string | **Yes** | Hex color code for the segment |

### Angle Configuration

The gauge arc can be customized using `start_angle` and `end_angle`:

- **Angle System**: 0° = top of gauge, angles increase clockwise
- **start_angle**: Where the gauge arc begins (default: 200°)
- **end_angle**: Where the gauge arc ends (default: 160°)
- The gauge automatically handles wrapping around 360°
- The needle will always travel along the shortest arc and never cross the "dead zone"

**Common angle configurations:**
- Default (200° to 160°): Classic lower 3/4 arc
- Full semicircle (270° to 90°): Bottom half
- Upper arc (180° to 0°): Top half
- Custom ranges for specific aesthetic needs

## Examples

### Temperature Monitor

```yaml
type: custom:steam-gauge-card
entity: sensor.living_room_temperature
title: Room Temperature
min: 50
max: 90
unit: "°F"
decimals: 1
segments:
  - from: 50
    to: 65
    color: '#2196F3'  # Blue - Cold
  - from: 65
    to: 75
    color: '#4CAF50'  # Green - Comfortable
  - from: 75
    to: 90
    color: '#FF5722'  # Orange - Hot
```

### Humidity Gauge

```yaml
type: custom:steam-gauge-card
entity: sensor.humidity
title: Humidity
min: 0
max: 100
unit: "%"
segments:
  - from: 0
    to: 30
    color: '#FF9800'  # Orange - Too dry
  - from: 30
    to: 60
    color: '#4CAF50'  # Green - Ideal
  - from: 60
    to: 100
    color: '#2196F3'  # Blue - Too humid
```

### Power Consumption

```yaml
type: custom:steam-gauge-card
entity: sensor.power_consumption
title: Power Usage
min: 0
max: 5000
unit: "W"
decimals: 0
segments:
  - from: 0
    to: 1000
    color: '#4CAF50'  # Green - Low
  - from: 1000
    to: 3000
    color: '#FFC107'  # Yellow - Medium
  - from: 3000
    to: 5000
    color: '#F44336'  # Red - High
```

### CPU Temperature

```yaml
type: custom:steam-gauge-card
entity: sensor.cpu_temperature
title: CPU Temperature
min: 20
max: 100
unit: "°C"
decimals: 1
segments:
  - from: 20
    to: 60
    color: '#4CAF50'  # Green - Safe
  - from: 60
    to: 80
    color: '#FF9800'  # Orange - Warm
  - from: 80
    to: 100
    color: '#F44336'  # Red - Critical
```

### Fast Animation for Real-time Data

```yaml
type: custom:steam-gauge-card
entity: sensor.current_power
title: Real-time\nPower
min: 0
max: 3000
unit: "W"
decimals: 0
animation_duration: 0.5  # Faster animation
title_font_size: 11
segments:
  - from: 0
    to: 1000
    color: '#4CAF50'
  - from: 1000
    to: 2000
    color: '#FFC107'
  - from: 2000
    to: 3000
    color: '#F44336'
```

## Design Features

- **Vintage Aesthetic**: Aged beige/cream background with subtle texture
- **Brass Rim**: Gradient brass border with realistic metallic sheen
- **Rivets**: Decorative corner rivets for industrial look
- **Wear Marks**: Random age spots and wear marks for authenticity
- **Glass Effect**: Subtle highlight overlay simulating glass cover
- **Red Needle**: Bold red needle with shadow and highlight
- **Flip Display**: Digital odometer-style display with smooth rolling animation
- **Smooth Animation**: Configurable animation duration (default 1.2s) with ease-out transition
- **Multi-line Titles**: Support for up to 3 lines of text in title using `\n`

## Browser Compatibility

Works with all modern browsers that support:
- Custom Elements (Web Components)
- SVG
- CSS transforms and transitions

## Troubleshooting

**Card doesn't appear:**
- Verify the file is in `config/www/`
- Check that the resource is added in Lovelace
- Clear browser cache
- Check browser console for errors

**Needle doesn't move:**
- Verify entity exists and has a numeric state
- Check min/max values include the entity's value range

**Colors don't show:**
- Verify color codes are valid hex values (e.g., `#FF0000`)
- Check that segment ranges cover the full min/max range

## License

Free to use and modify for personal use.


