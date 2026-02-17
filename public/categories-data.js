// ============================================================
// CATEGORY DATA — Single source of truth for all pricing
// Edit this file for pricing/feature changes
// ============================================================

const RESIDENTIAL_CATEGORIES = [
  {
    id: 'prewire',
    section: 'Infrastructure',
    name: 'Structured Wiring & Pre-Wire',
    icon: '🔌',
    desc: 'Low voltage wiring infrastructure for all technology systems',
    sizeScale: 1.0,
    tiers: {
      good: {
        price: 12000,
        label: 'Essential',
        tag: 'Good',
        features: [
          'Dual CAT6 for TVs to main rooms, single CAT6 to others',
          'Basic coax (RG6) to all TVs',
          'Standard structured media panel',
          'Speaker wire to primary living area'
        ],
        brands: 'Cat6, RG6 coax, 16-4, Leviton panel'
      },
      standard: {
        price: 22000,
        label: 'Standard',
        tag: 'Standard',
        features: [
          'Dual Cat6 to all TVs',
          'Speaker wire to primary living area, lanai, and master bed',
          'Camera pre-wire (front and rear basics)',
          'Alarm pre-wire for all doors, single keypad at garage entry',
          'Upgraded structured media panel with fiber optic incoming'
        ],
        brands: 'Cat6, Single mode fiber optic, 16/4 speaker wire, Future Automation Structured Media Panel'
      },
      better: {
        price: 35000,
        label: 'Comprehensive',
        tag: 'Better',
        features: [
          'Dual Cat6A to all TVs',
          'Speaker wire to all living areas, lanai, kitchen, master suite, and single outdoor zone',
          'Outside perimeter camera pre-wire',
          'Alarm pre-wire for all doors and windows, keypads at garage entry and master bedroom',
          'Lutron shade pre-wire to all main living area windows and master bedroom',
          'Upgraded structured media panel with fiber optic and conduit for incoming pathway'
        ],
        brands: 'Cat6A, Single mode fiber optic, 16/2 speaker wire, Lutron shade wire, Direct Burial 16/4, Future Automation Structured Media Panel'
      },
      best: {
        price: 44000,
        label: 'Premium',
        tag: 'Best',
        features: [
          'Dual Cat6A to all TVs plus CAT7 to main rooms',
          'Pre-wire for extensive audio zones + single Atmos room',
          'Full outside perimeter camera pre-wire + gate/entry points',
          'Alarm pre-wire for all doors and windows, keypads at garage entry(s) and master bedroom',
          'Shade pre-wire to most (if not all) windows',
          'Multiple zone outdoor landscape speaker pre-wire and conduit',
          'Gate/intercom wiring',
          'Guest house connectivity',
          'Upgraded structured media panels (multiple) including fiber optic and conduit for incoming pathways'
        ],
        brands: 'Cat6A, Single mode fiber optic, 16/2 speaker wire, Lutron shade wire, Direct Burial 16/4, Future Automation Structured Media Panel'
      }
    }
  },
  {
    id: 'networking',
    section: 'Infrastructure',
    name: 'Whole-Home WiFi & Networking',
    icon: '📡',
    desc: 'Enterprise-grade WiFi coverage and network infrastructure',
    sizeScale: 0.8,
    tiers: {
      good: {
        price: 5700,
        label: 'Reliable, Basic Coverage',
        tag: 'Good',
        features: [
          'WiFi 7 access points for full interior coverage and lanai',
          'Cloud managed pro router',
          'Managed PoE switch',
          'App-managed, remote access'
        ],
        brands: 'UniFi LR, USW-Pro-24-PoE'
      },
      better: {
        price: 9700,
        label: 'Full Coverage',
        tag: 'Better',
        features: [
          'WiFi 7 access points for full interior, lanai, and garage(s)',
          'Cloud managed pro router',
          'Managed pro series PoE+ switches with 10G uplinks',
          'UPS backup for short power outages',
          'App-managed, remote access'
        ],
        brands: 'UniFi Pro, Unifi UPS, UDM Pro'
      },
      best: {
        price: 15000,
        label: 'Enterprise Class',
        tag: 'Best',
        features: [
          'High capacity WiFi 7 access points for full interior, lanai, and garage(s)',
          'Cloud managed pro router with support for multiple internet connections',
          'Managed enterprise series PoE+ switches with 10G uplinks',
          'UPS backup for short power outages',
          'App-managed, remote access'
        ],
        brands: 'UniFi Enterprise, Unifi UPS, UDM Pro'
      }
    }
  },
  {
    id: 'surveillance',
    section: 'Security',
    name: 'Surveillance & Security Cameras',
    icon: '📹',
    desc: 'IP camera system with recording and smart detection',
    sizeScale: 0.7,
    baseTierNoScale: true,
    tiers: {
      good: {
        price: 5300,
        label: 'Key Coverage',
        tag: 'Good',
        features: [
          'Basic front and rear exterior coverage',
          '4K cameras',
          '14 day recording retention',
          'Motion alerts to phone',
          'Night vision & weather-rated'
        ],
        brands: 'UniFi'
      },
      better: {
        price: 10700,
        label: 'Enhanced Coverage',
        tag: 'Better',
        features: [
          'Exterior entry points covered including front and rear',
          '4K enhanced cameras with AI detection',
          '21-day recording retention',
          'Integration for viewing on TVs',
          'Marine-grade outdoor housings'
        ],
        brands: 'UniFi Pro Series'
      },
      best: {
        price: 19300,
        label: 'Full Perimeter',
        tag: 'Best',
        features: [
          'Full perimeter coverage',
          'AI searching and analytics (person/vehicle/animal)',
          '21-day recording',
          'Interior camera for garage(s)',
          'Control4/Crestron integration'
        ],
        brands: 'UniFi Pro Series, Cloud Key'
      }
    }
  },
  {
    id: 'audio',
    section: 'Audio',
    name: 'Multi-Room Audio',
    icon: '🔊',
    desc: 'Whole-home distributed audio — indoor and outdoor zones',
    sizeScale: 0.7,
    tiers: {
      good: {
        price: 9600,
        label: 'Basic',
        tag: 'Good',
        features: [
          'Main living areas with music',
          'Basic outdoor in ceiling zone',
          'Architectural in-ceiling speakers',
          'App-controlled music',
          'AirPlay 2 & all streaming services'
        ],
        brands: 'Sonos Amp, Sonos Architectural by Sonance, Control4, Crestron'
      },
      standard: {
        price: 18000,
        label: 'Standard',
        tag: 'Standard',
        features: [
          'Main living areas, kitchen and master suite with music',
          'Outdoor in-ceiling audio zone(s)',
          'Upgraded in ceiling speakers',
          'Automation system integration'
        ],
        brands: 'Sonos Amp, Sonos Architectural by Sonance, Control4, Crestron, Sonance'
      },
      better: {
        price: 27000,
        label: 'Entertainment Focused',
        tag: 'Better',
        features: [
          'Main living areas, kitchen, guest area(s), and master suite with music',
          'Outdoor in-ceiling audio zone(s)',
          'More speakers in living areas to eliminate loud spots during entertaining',
          'Premium in-ceiling speakers',
          'Automation system integration'
        ],
        brands: 'Sonos Amp, Sonos Architectural by Sonance, Control4, Crestron'
      },
      best: {
        price: 32000,
        label: 'Music Lover',
        tag: 'Best',
        features: [
          'Main living areas, kitchen, guest area(s), and master suite with music',
          'Outdoor in-ceiling audio zone(s)',
          'Ultra Premium in-ceiling speakers in main listening areas',
          'In ceiling/in wall subwoofer(s) in main listening area(s)',
          'Automation system integration'
        ],
        brands: 'Sonos Amp, Sonos Architectural by Sonance, Control4, Crestron, Monitor Audio, Sonance, B&W'
      }
    }
  },
  {
    id: 'invisible-speakers',
    section: 'Audio',
    name: 'Invisible Speakers',
    icon: '🪄',
    desc: 'For those who want the cleanest design — speakers completely hidden behind drywall',
    sizeScale: 0.5,
    tiers: {
      good: {
        price: 7500,
        sizeScale: 0.2,
        label: 'Key Coverage',
        tag: 'Good',
        features: [
          'Key area(s) provided with invisible speakers'
        ],
        brands: 'Amina Loudspeakers, Stealth Acoustics'
      },
      standard: {
        price: 10500,
        sizeScale: 0.3,
        label: 'Main Living',
        tag: 'Standard',
        features: [
          'Main living area(s) including kitchen or other key area(s) provided with invisible speakers'
        ],
        brands: 'Amina Loudspeakers, Stealth Acoustics'
      },
      better: {
        price: 28500,
        sizeScale: 0.5,
        label: 'Whole Home',
        tag: 'Better',
        features: [
          'Replace all interior speakers with invisible speakers'
        ],
        brands: 'Amina Loudspeakers, Stealth Acoustics'
      },
      best: {
        price: 38500,
        sizeScale: 0.6,
        label: 'Whole Home, Premium',
        tag: 'Best',
        features: [
          'Replace all interior speakers with premium invisible speakers',
          'Invisible subwoofers installed in key areas'
        ],
        brands: 'Amina Loudspeakers, Stealth Acoustics'
      }
    }
  },
  {
    id: 'surround',
    section: 'Audio',
    name: 'Surround Sound',
    icon: '🔉',
    desc: 'Immersive surround audio for your main TV without a dedicated theater room',
    sizeScale: 0.0,
    tiers: {
      good: {
        price: 5300,
        label: 'Sonos Surround',
        tag: 'Good',
        features: [
          'Sonos Arc Ultra Soundbar wall mounted',
          '2 Sonos in-ceiling speakers',
          'Sonos Sub',
          'Apple TV 4K source',
          'Behind TV box for video sources'
        ],
        brands: 'Sonos, Apple TV 4K'
      },
      better: {
        price: 9900,
        label: 'Custom Surround',
        tag: 'Better',
        features: [
          'Soundbar custom made to match TV width',
          '4 in-ceiling speakers for Atmos and Surround',
          'Single in-wall subwoofer',
          'Atmos Surround Amplifier',
          'Apple TV 4K source',
          'Large behind TV box for local components'
        ],
        brands: 'Sony AVR, Sonance, Leon, Apple TV 4K, Future Automation'
      },
      best: {
        price: 15900,
        label: 'Invisible Surround',
        tag: 'Best',
        features: [
          'Invisible front, rear, and in-ceiling speakers',
          'Coverage for Atmos and Surround',
          'Dual in-wall invisible subwoofers',
          'Atmos Surround Amplifier',
          'Apple TV 4K source',
          'Large behind TV box for local components'
        ],
        brands: 'Sony AVR, Amina Loudspeakers, Apple TV 4K, Future Automation'
      }
    }
  },
  {
    id: 'theater',
    section: 'Audio',
    name: 'Home Theater / Media Room',
    icon: '🎬',
    desc: 'Dedicated entertainment experience — from media room to reference theater (display not included)',
    sizeScale: 0.0,
    tiers: {
      good: {
        price: 26000,
        label: 'Media Room',
        tag: 'Good',
        features: [
          'NO DISPLAY INCLUDED (see Video Wall)',
          '5.2.2 Dolby Atmos surround',
          'Combination of in-ceiling/in-wall speakers',
          'Dual subwoofers (in-wall or in-room)',
          'Atmos Surround Amplifier',
          'Dimmable lighting scene ("Movie Mode")',
          'Apple TV 4K source',
          'Automation system control (app and remote)'
        ],
        brands: 'Sonance, Sony AVR, Apple TV 4K, Lutron, Control4'
      },
      standard: {
        price: 62000,
        label: 'Theater Quality',
        tag: 'Standard',
        features: [
          'NO DISPLAY INCLUDED (see Video Wall)',
          '7.2.2 Dolby Atmos audio',
          'Premium in-wall speakers & 2 subs',
          'Dedicated AV receiver + amplification',
          'Full light control',
          'Automation system control (app and remote)',
          'Kaleidescape movie server',
          'Dedicated in-room equipment rack'
        ],
        brands: 'Monitor Audio, Leon, Amina Loudspeakers, Sony AVR, Lutron, Control4, Crestron, Kaleidescape'
      },
      better: {
        price: 129000,
        label: 'Reference Theater',
        tag: 'Better',
        features: [
          'NO DISPLAY INCLUDED (see Video Wall)',
          '9.4.4 Dolby Atmos Reference Audio',
          'Reference quality in-wall speakers & subs',
          'Dedicated AV receiver',
          'Dedicated multi-channel amplification',
          'Full light control',
          'Automation system control (app and remote)',
          'Dedicated in-room equipment rack',
          'Kaleidescape movie server',
          'Full acoustic engineering'
        ],
        brands: 'Monitor Audio, Leon, Amina Loudspeakers, Marantz, Sony, Lutron, Control4, Crestron, Kaleidescape, Triad, B&W'
      },
      best: {
        price: 187000,
        label: 'Full Theater Experience',
        tag: 'Best',
        features: [
          'NO DISPLAY INCLUDED (see Video Wall)',
          '9.4.6 Dolby Atmos Reference Audio',
          'Reference quality in-wall speakers & subs',
          'Dedicated AV receiver',
          'Dedicated multi-channel amplification',
          'Full light control',
          'Automation system control (app and remote)',
          'Dedicated in-room equipment rack',
          'Kaleidescape movie server',
          'Full acoustic engineering',
          '$20,000 seating budget included',
          '$15,000 acoustical paneling budget included'
        ],
        brands: 'Monitor Audio, Leon, Amina Loudspeakers, Marantz, Sony, Lutron, Control4, Crestron, Kaleidescape, Triad, B&W'
      }
    }
  },
  {
    id: 'videodist',
    section: 'Video',
    name: 'TV Mounting & Video Distribution',
    icon: '📺',
    desc: 'TV installations, mounting, and source distribution throughout the home',
    sizeScale: 0.7,
    tiers: {
      good: {
        price: 5500,
        label: 'Local Sources, Basic',
        tag: 'Good',
        features: [
          'Main TVs mounted (fixed/tilt)',
          'Apple TV at each location',
          'In-wall HDMI & cable concealment'
        ],
        brands: 'Strong Mounts, Apple TV 4K, in-wall HDMI'
      },
      better: {
        price: 9200,
        label: 'Local Sources, Preferred',
        tag: 'Better',
        features: [
          'Main TVs mounted (Articulating)',
          'Apple TV at each location',
          'In-wall HDMI & cable concealment',
          'Surge protection at each TV',
          'Large back box behind TV to hold components and surge protector'
        ],
        brands: 'Strong Mounts, Apple TV 4K, in-wall HDMI, WattBox'
      },
      best: {
        price: 29000,
        sizeScale: 0.5,
        label: 'Video Over IP Distribution',
        tag: 'Best',
        features: [
          'Main TVs mounted (Articulating mounts)',
          'Main TVs with video matrix switching',
          'Any source on any TV',
          'Perfect syncing of TV video for parties/events',
          'Automation system control of Main TVs (remote and app)',
          'Cable concealment',
          'Surge protection at each TV',
          'Large back box behind TV to hold components and surge protector'
        ],
        brands: 'Control4, Crestron, Binary, Strong Mounts, Future Automation, Apple TV 4K, WattBox OvRC'
      }
    }
  },
  {
    id: 'control',
    section: 'Control & Automation',
    name: 'Control & Automation System',
    icon: '🎛️',
    desc: 'Unified control of all systems from touchscreens, remotes, and app',
    sizeScale: 0.6,
    tiers: {
      good: {
        price: 9500,
        label: 'Automation Basic',
        tag: 'Good',
        features: [
          'Automation System Controller',
          'Single Remote and App control of main TVs',
          'Integration of installed components including lighting, music, and TVs',
          'Basic scenes (Morning, Night, Movie)'
        ],
        brands: 'Control4, Crestron'
      },
      better: {
        price: 16000,
        label: 'Automation Enhanced',
        tag: 'Better',
        features: [
          'Advanced Automation System Controller',
          'Single Remote and App control of main TVs',
          'Upgraded premium remotes',
          'Integration of installed, compatible components including lighting, shades, music, cameras, thermostats, gates, and TVs',
          'Advanced scenes & scheduling'
        ],
        brands: 'Control4, Crestron'
      },
      best: {
        price: 29500,
        label: 'Full Automation',
        tag: 'Best',
        features: [
          'Advanced Automation System Controller',
          'Single Remote and App control of all TVs',
          'Upgraded premium remotes for main TVs',
          'Full integration of any installed, compatible components including lighting, shades, music, security, cameras, thermostats, pool, gates, and TVs',
          'Advanced scenes & scheduling'
        ],
        brands: 'Control4, Crestron'
      }
    }
  },
  {
    id: 'touchscreen',
    section: 'Control & Automation',
    name: 'Touchscreens',
    icon: '📱',
    desc: 'The dedicated hub for instant home control—perfect for you and seamless for your guests',
    sizeScale: 0,
    tiers: {
      good: {
        price: 2200,
        label: 'Touchscreen Essential',
        tag: 'Good',
        features: [
          'On-wall iPad mini in main living area'
        ],
        brands: 'iPort, Apple'
      },
      standard: {
        price: 4800,
        label: 'Touchscreen Basic',
        tag: 'Standard',
        features: [
          'On-wall iPads in main living area and master suite'
        ],
        brands: 'iPort, Apple'
      },
      better: {
        price: 7200,
        label: 'Touchscreen Standard',
        tag: 'Better',
        features: [
          'On-wall iPads in main living area and master suite',
          'Desk mounted iPad mini for kitchen'
        ],
        brands: 'iPort, Apple'
      },
      best: {
        price: 23200,
        sizeScale: 0.5,
        label: 'Touchscreen Full',
        tag: 'Best',
        features: [
          'On-wall iPads or automation system touchscreens in all living areas, kitchen, guest suites (most if not all), and office/study',
          'Desk mounted option where appropriate'
        ],
        brands: 'iPort, Apple, Crestron, Control4'
      }
    }
  },
  {
    id: 'lighting',
    section: 'Lighting & Shades',
    name: 'Wireless Lighting Control',
    icon: '💡',
    desc: 'Smart lighting with scene control, dimming, and scheduling',
    sizeScale: 1,
    tiers: {
      good: {
        price: 5500,
        sizeScale: 0.4,
        label: 'Wireless Basic',
        tag: 'Good',
        features: [
          'Wireless lighting control in main living areas and kitchen',
          'App control from phone whether at home or away',
          'Integration with control system (if selected)'
        ],
        brands: 'Lutron Caseta'
      },
      better: {
        price: 15000,
        sizeScale: 0.4,
        label: 'Wireless Partial',
        tag: 'Better',
        features: [
          'Wireless lighting control in main living areas, kitchen, and master suite',
          'Scene keypads for each area and at entry(s). Push one button and lights automatically adjust',
          'App control from phone whether at home or away',
          'Integration with control system (if selected)'
        ],
        brands: 'Lutron RadioRA, Control4 Contemporary, Crestron Cameo'
      },
      best: {
        price: 32000,
        sizeScale: 0.9,
        label: 'Wireless Full Home',
        tag: 'Best',
        features: [
          'Wireless lighting control on every switch in the home',
          'Scene keypads in every room',
          'Comprehensive scenes (Wake, Entertain, Night, Away)',
          'App control from phone whether at home or away'
        ],
        brands: 'Lutron RadioRA, Control4 Contemporary, Crestron Cameo'
      }
    }
  },
  {
    id: 'lighting-centralized',
    section: 'Lighting & Shades',
    name: 'Centralized / Hybrid Lighting Control',
    icon: '🔆',
    desc: 'Hardwired smart lighting control for max reliability and convenience including scene control, dimming, and scheduling',
    sizeScale: 1,
    tiers: {
      good: {
        price: 30000,
        sizeScale: 0.4,
        label: 'Centralized Partial',
        tag: 'Good',
        features: [
          'Lighting control in main living areas, kitchen, and master suite',
          'Clean look on wall, no banks of switches',
          'Scene keypads in every room',
          'Integration with control system (if selected)',
          'App control from phone whether at home or away',
          'Comprehensive scenes (Wake, Entertain, Night, Away)'
        ],
        brands: 'Lutron HomeWorks, Control4 Centralized, Crestron Centralized'
      },
      better: {
        price: 47000,
        sizeScale: 0.9,
        label: 'Hybrid Full Home',
        tag: 'Better',
        features: [
          'Combination of wireless and centralized lighting',
          'Lighting control on every switch in the home',
          'Main living areas, kitchen, and master suite are centralized',
          'Other areas are wireless',
          'Scene keypads in every room',
          'Integration with control system (if selected)',
          'App control from phone whether at home or away',
          'Comprehensive scenes (Wake, Entertain, Night, Away)'
        ],
        brands: 'Lutron RadioRA, Control4 Contemporary, Crestron Cameo, Lutron HomeWorks, Control4 Centralized, Crestron Centralized'
      },
      best: {
        price: 60000,
        sizeScale: 0.9,
        label: 'Centralized Full Home',
        tag: 'Best',
        features: [
          'Centralized, hardwired lighting control of all lighting in the home',
          'Clean look on wall, no banks of switches',
          'Scene keypads in every room',
          'Integration with control system (if selected)',
          'App control from phone whether at home or away',
          'Comprehensive scenes (Wake, Entertain, Night, Away)'
        ],
        brands: 'Lutron HomeWorks, Control4 Centralized, Crestron Centralized'
      }
    }
  },
  {
    id: 'lighting-designer',
    section: 'Lighting & Shades',
    name: 'Designer Lighting Keypads',
    icon: '✨',
    desc: 'Elevate your lighting control with premium designer keypads featuring custom finishes and engraving',
    sizeScale: 0,
    tiers: {
      good: {
        price: 6000,
        sizeScale: 0.4,
        label: 'Partial Home',
        tag: 'Good',
        features: [
          'Upgraded designer lighting keypads/switches in main living areas, kitchen, and master suite',
          'Designer color/finish options',
          'Custom engraving of keypad buttons'
        ],
        brands: 'Lutron Sunnata (designer colors), Control4 Lux, Crestron Horizon, Lutron Palladiom'
      },
      better: {
        price: 10000,
        sizeScale: 1,
        label: 'Full Home',
        tag: 'Better',
        features: [
          'Upgraded designer lighting keypads/switches throughout the home',
          'Designer color/finish options',
          'Custom engraving of keypad buttons'
        ],
        brands: 'Lutron Sunnata (designer colors), Control4 Lux, Crestron Horizon, Lutron Palladiom'
      },
      best: {
        price: 20000,
        sizeScale: 1,
        label: 'Full Home Bespoke',
        tag: 'Best',
        features: [
          'Upgraded bespoke lighting keypads/switches throughout the home',
          'Designer color/finish options',
          'Custom engraving of keypad buttons'
        ],
        brands: 'Lutron Palladiom Glass/Metal, Lutron Alisse, Black Nova'
      }
    }
  },
  {
    id: 'shades',
    section: 'Lighting & Shades',
    name: 'Motorized Shades',
    icon: '🪟',
    desc: 'Automated window treatments with scene integration',
    sizeScale: 0.9,
    tiers: {
      good: {
        price: 35000,
        sizeScale: 0.4,
        label: 'Key Windows',
        tag: 'Good',
        features: [
          'Lutron motorized shades in single living area and master bedroom',
          'Hardwired for max reliability',
          'Light filtering or solar screen fabric',
          'App and remote control',
          'Integrated with control system (if selected)',
          'Standard pockets'
        ],
        brands: 'Lutron Sivoia, standard fabrics'
      },
      better: {
        price: 70000,
        sizeScale: 0.8,
        label: 'Standard Windows',
        tag: 'Better',
        features: [
          'Lutron motorized shades in main living areas, master bedroom, and primary guest and/or master bath',
          'Hardwired for max reliability',
          'Mixture of light filtering, solar screen, and black out fabric',
          'Mixture of in-wall keypads, app, and remote controls',
          'Integrated with control system (if selected)',
          'Standard pockets',
          'Automated scenes (Morning, Movie, Entertaining)',
          'Upgraded fabric selections'
        ],
        brands: 'Lutron Sivoia, upgraded fabrics'
      },
      best: {
        price: 100000,
        label: 'Most/All Windows',
        tag: 'Best',
        features: [
          'Lutron motorized shades on most, if not every window',
          'Hardwired for max reliability',
          'Mixture of light filtering, solar screen, and black out fabric',
          'Possible drapery tracks on select windows',
          'Mixture of in-wall keypads, app, and remote controls',
          'Integrated with control system (if selected)',
          'Standard pockets',
          'Automated scenes (Morning, Movie, Entertaining)',
          'Upgraded fabric selections'
        ],
        brands: 'Lutron Sivoia, designer fabrics, Lutron drapery tracks'
      }
    }
  },
  {
    id: 'outdoor',
    section: 'Audio',
    name: 'Yard/Pool Audio',
    icon: '🌴',
    desc: 'Weather-rated outdoor audio and speakers',
    sizeScale: 0.6,
    tiers: {
      good: {
        price: 6000,
        sizeScale: 0.2,
        label: 'Basic',
        tag: 'Good',
        features: [
          'Single outdoor zone with landscape style speakers',
          'Weather-rated speakers',
          'Integrated with whole-home audio',
          'Basic coverage for entertaining'
        ],
        brands: 'Sonos, Sonance Landscape'
      },
      better: {
        price: 17000,
        sizeScale: 0.2,
        label: 'Preferred',
        tag: 'Better',
        features: [
          'Coastal Source speakers with sub',
          'Premium outdoor audio coverage',
          'Integrated with whole-home audio',
          'IP68 rated for salt air'
        ],
        brands: 'Coastal Source Razor, Coastal Source Linesource'
      },
      best: {
        price: 24000,
        sizeScale: 0.4,
        label: 'Premium',
        tag: 'Best',
        features: [
          'Coastal Source premium system',
          'Comprehensive speakers with dedicated subs',
          'Independently controlled zones (where appropriate)',
          'Full yard coverage',
          'Premium amplification',
          'Integrated with whole-home audio',
          'IP68 rated for salt air'
        ],
        brands: 'Coastal Source Ellipse/Line Source, Coastal Source Razor'
      }
    }
  },
  {
    id: 'security',
    section: 'Security',
    name: 'Security & Alarm System',
    icon: '🔒',
    desc: 'Intrusion detection, sensors, and 24/7 monitoring',
    sizeScale: 0.6,
    tiers: {
      good: {
        price: 3500,
        sizeScale: 0.5,
        label: 'Essential Protection',
        tag: 'Good',
        features: [
          'Coverage of all exterior doors',
          'Motion detectors',
          'Keypad at garage entry',
          'Supports 24/7 professional monitoring',
          'App control via Alarm.com'
        ],
        brands: 'DSC Neo, Alarm.com'
      },
      better: {
        price: 7500,
        sizeScale: 0.8,
        label: 'Standard Security',
        tag: 'Better',
        features: [
          'Coverage of all exterior windows and doors',
          'Motion detectors',
          'Keypads at garage entry(s) and master bedroom',
          'Supports 24/7 professional monitoring',
          'App control via Alarm.com'
        ],
        brands: 'DSC Neo, Alarm.com'
      },
      best: {
        price: 9500,
        sizeScale: 0.8,
        label: 'Full Integration',
        tag: 'Best',
        features: [
          'Commercial-grade panel + full sensor coverage',
          'Multi method motion detectors',
          'Keypads at garage entry(s), safe room (if appropriate), and master bedroom',
          'Supports 24/7 professional monitoring',
          'App control via Alarm.com',
          'Full Crestron/Control4 integration',
          'Panic buttons on keypads'
        ],
        brands: 'DSC PowerSeries Neo / Qolsys, Alarm.com'
      }
    }
  },
  {
    id: 'intercom',
    section: 'Security',
    name: 'Intercom, Doorbell & Access Control',
    icon: '🚪',
    desc: 'Video doorbell, gate intercom, and entry access management',
    sizeScale: 0.2,
    tiers: {
      good: {
        price: 2000,
        label: 'Video Doorbell',
        tag: 'Good',
        features: [
          'Hardwired video doorbell (PoE)',
          '2-way audio & video at front door',
          'App notifications when someone rings'
        ],
        brands: 'UniFi, Control4'
      },
      better: {
        price: 7500,
        label: 'Video Doorbell + Gate',
        tag: 'Better',
        features: [
          'Hardwired video doorbell (PoE)',
          '2-way audio & video at front door',
          'App notifications when someone rings',
          'Gate video intercom with keypad',
          'Integration with automatic gate for opening and closing',
          'Remote gate open from phone'
        ],
        brands: 'UniFi, Control4'
      },
      best: {
        price: 10500,
        label: 'Premium Video Doorbell and Gate',
        tag: 'Best',
        features: [
          'Premium hardwired doorbell station (PoE)',
          '2-way audio & video at front door',
          'App notifications when someone rings',
          'Gate video intercom with keypad',
          'Integration with automatic gate for opening and closing',
          'Remote gate open from phone',
          'Multi-tenant/guest access codes',
          'Full Crestron/Control4 integration'
        ],
        brands: 'UniFi, Control4, 2N'
      }
    }
  },
  {
    id: 'videowall-interior',
    section: 'Video',
    name: 'Video Wall Interior',
    icon: '🖥️',
    desc: 'Large-format LED video wall installations for indoor spaces',
    sizeScale: 0.0,
    tiers: {
      good: {
        price: 50000,
        label: '136" Display Standard',
        tag: 'Good',
        features: [
          'High density pixels for clear picture (1.2pp)',
          'Supports up to 3 video signals at the same time',
          '3 4K Apple TVs',
          'Professional calibration and installation',
          'Integration with Control4 or Crestron'
        ],
        brands: 'Opal Screens Crystal Series'
      },
      standard: {
        price: 69000,
        label: '136" Display Premium',
        tag: 'Standard',
        features: [
          'Super high density pixels for clearest picture (.9pp)',
          'Supports up to 4 video signals at the same time',
          'BlackFire technology for the deepest blacks',
          '4 4K Apple TVs',
          'Professional calibration and installation',
          'Integration with Control4 or Crestron',
          'Ambient art mode with customer provided art'
        ],
        brands: 'Opal Screens Crystal Series'
      },
      better: {
        price: 89000,
        label: '163" Display Premium',
        tag: 'Better',
        features: [
          'Super high density pixels for clearest picture (.9pp)',
          'Supports up to 4 video signals at the same time',
          'BlackFire technology for the deepest blacks',
          '4 4K Apple TVs',
          'Professional calibration and installation',
          'Integration with Control4 or Crestron',
          'Ambient art mode with customer provided art'
        ],
        brands: 'Opal Screens Crystal Series'
      },
      best: {
        price: 119000,
        label: '190" Display Premium',
        tag: 'Best',
        features: [
          'Super high density pixels for clearest picture (.9pp)',
          'Supports up to 4 video signals at the same time',
          'BlackFire technology for the deepest blacks',
          '4 4K Apple TVs',
          'Professional calibration and installation',
          'Integration with Control4 or Crestron',
          'Ambient art mode with customer provided art'
        ],
        brands: 'Opal Screens Crystal Series'
      }
    }
  },
  {
    id: 'videowall-exterior',
    section: 'Video',
    name: 'Video Wall Exterior',
    icon: '☀️',
    desc: 'Weather-rated outdoor LED video wall installations',
    sizeScale: 0.0,
    tiers: {
      good: {
        price: 83000,
        label: '136" Outdoor Display Standard',
        tag: 'Good',
        features: [
          'Outdoor weather rated for direct exposure to the weather',
          '8X brighter than indoor models for direct sun viewing',
          'High density pixels for clear picture (1.5pp)',
          'Supports up to 3 video signals at the same time',
          '3 4K Apple TVs',
          'Professional calibration and installation',
          'Integration with Control4 or Crestron'
        ],
        brands: 'Opal Screens Water Series'
      },
      standard: {
        price: 109000,
        label: '136" Outdoor Display Premium',
        tag: 'Standard',
        features: [
          'Outdoor weather rated for direct exposure to the weather',
          '8X brighter than indoor models for direct sun viewing',
          'Super high density pixels for clearest picture (1.2pp)',
          'Supports up to 4 video signals at the same time',
          'BlackFire technology for the deepest blacks',
          '4 4K Apple TVs',
          'Professional calibration and installation',
          'Integration with Control4 or Crestron',
          'Ambient art mode with customer provided art'
        ],
        brands: 'Opal Screens Water Series'
      },
      better: {
        price: 149000,
        label: '163" Outdoor Display Premium',
        tag: 'Better',
        features: [
          'Outdoor weather rated for direct exposure to the weather',
          '8X brighter than indoor models for direct sun viewing',
          'Super high density pixels for clearest picture (1.2pp)',
          'Supports up to 4 video signals at the same time',
          'BlackFire technology for the deepest blacks',
          '4 4K Apple TVs',
          'Professional calibration and installation',
          'Integration with Control4 or Crestron',
          'Ambient art mode with customer provided art'
        ],
        brands: 'Opal Screens Water Series'
      },
      best: {
        price: 179000,
        label: '190" Outdoor Display Premium',
        tag: 'Best',
        features: [
          'Outdoor weather rated for direct exposure to the weather',
          '8X brighter than indoor models for direct sun viewing',
          'Super high density pixels for clearest picture (1.2pp)',
          'Supports up to 4 video signals at the same time',
          'BlackFire technology for the deepest blacks',
          '4 4K Apple TVs',
          'Professional calibration and installation',
          'Integration with Control4 or Crestron',
          'Ambient art mode with customer provided art'
        ],
        brands: 'Opal Screens Water Series'
      }
    }
  }
];

const RESIDENTIAL_EXTRAS = [
  { id: 'poolAlarm', name: 'Pool Alarm & Child Safety', note: 'Required by FL building code', price: 2200, sizeScale: 1, default: false },
  { id: 'fireDet', name: 'Low Voltage Fire Detection', note: 'Monitored smoke/heat/CO', price: 3800, sizeScale: 0.3, default: false },
  { id: 'leakDet', name: 'Leak Detection System', note: 'Water heater, laundry, sinks', price: 3500, sizeScale: 0.2, default: false }
];

// ---- CONDO DATA ----

// Clone of residential, then override specific categories
const CONDO_CATEGORIES = JSON.parse(JSON.stringify(RESIDENTIAL_CATEGORIES));
const CONDO_EXTRAS = JSON.parse(JSON.stringify(RESIDENTIAL_EXTRAS));

// Helper: find and override a condo category by id
function condoOverride(id, overrides) {
  const cat = CONDO_CATEGORIES.find(c => c.id === id);
  if (cat) Object.assign(cat, overrides);
}

// -- Condo: Structured Wiring & Pre-Wire --
condoOverride('prewire', {
  tiers: {
    good: {
      price: 14000,
      label: 'Essential',
      tag: 'Good',
      features: [
        'Dual CAT6 for TVs to main rooms, single CAT6 to others',
        'Basic coax (RG6) to all TVs',
        'Standard structured media panel',
        'Speaker wire to primary living area'
      ],
      brands: 'Cat6, RG6 coax, 16-4, Leviton panel'
    },
    standard: {
      price: 24000,
      label: 'Standard',
      tag: 'Standard',
      features: [
        'Dual Cat6 to all TVs',
        'Speaker wire to primary living areas, kitchen, and master bed',
        'Upgraded structured media panel with fiber optic incoming'
      ],
      brands: 'Cat6, Single mode fiber optic, 16/4 speaker wire, Future Automation Structured Media Panel'
    },
    better: {
      price: 35000,
      label: 'Comprehensive',
      tag: 'Better',
      features: [
        'Dual Cat6A to all TVs',
        'Speaker wire to all living areas, kitchen, master suite, and primary guest',
        'Lutron shade pre-wire to all main living area windows and master bedroom',
        'Upgraded structured media panel with fiber optic and conduit for incoming pathway'
      ],
      brands: 'Cat6A, Single mode fiber optic, 16/2 speaker wire, Lutron shade wire, Direct Burial 16/4, Future Automation Structured Media Panel'
    },
    best: {
      price: 44000,
      label: 'Premium',
      tag: 'Best',
      features: [
        'Dual Cat6A to all TVs plus CAT7 to main rooms',
        'Pre-wire for extensive audio zones + single Atmos room',
        'Full outside perimeter camera pre-wire + gate/entry points',
        'Shade pre-wire to all windows',
        'Upgraded structured media panels (multiple) including fiber optic and conduit for incoming pathways'
      ],
      brands: 'Cat6A, Single mode fiber optic, 16/2 speaker wire, Lutron shade wire, Future Automation Structured Media Panel'
    }
  }
});

// -- Condo: Networking --
condoOverride('networking', {
  tiers: {
    good: {
      price: 5700,
      label: 'Reliable, Basic Coverage',
      tag: 'Good',
      features: [
        'WiFi 7 access points for full interior coverage and balcony',
        'Cloud managed pro router',
        'Managed PoE switch',
        'App-managed, remote access'
      ],
      brands: 'Ubiquiti UniFi, Ruckus, Access Networks'
    },
    better: {
      price: 9700,
      label: 'Full Coverage',
      tag: 'Better',
      features: [
        'WiFi 7 access points for full interior and balcony coverage',
        'Cloud managed pro router',
        'Managed pro series PoE+ switches with 10G uplinks',
        'UPS backup for short power outages',
        'App-managed, remote access'
      ],
      brands: 'Ubiquiti UniFi, Ruckus, Access Networks'
    },
    best: {
      price: 15000,
      label: 'Enterprise Class',
      tag: 'Best',
      features: [
        'High capacity WiFi 7 access points for full interior and balcony coverage',
        'Cloud managed pro router with support for multiple internet connections',
        'Managed enterprise series PoE+ switches with 10G uplinks',
        'UPS backup for short power outages',
        'App-managed, remote access'
      ],
      brands: 'Ubiquiti UniFi, Ruckus, Access Networks'
    }
  }
});

// -- Condo: Remove categories not applicable --
['surveillance', 'outdoor', 'security', 'intercom'].forEach(id => {
  const idx = CONDO_CATEGORIES.findIndex(c => c.id === id);
  if (idx !== -1) CONDO_CATEGORIES.splice(idx, 1);
});

// -- Condo: Multi-Room Audio --
condoOverride('audio', {
  tiers: {
    good: {
      price: 9600,
      label: 'Basic',
      tag: 'Good',
      features: [
        'Main living areas with music',
        'Architectural in-ceiling speakers',
        'App-controlled music',
        'AirPlay 2 & all streaming services'
      ],
      brands: 'Sonos Amp, Sonos Architectural by Sonance, Control4, Crestron'
    },
    standard: {
      price: 18000,
      label: 'Standard',
      tag: 'Standard',
      features: [
        'Main living areas, kitchen and master suite with music',
        'Upgraded in ceiling speakers',
        'Automation system integration'
      ],
      brands: 'Sonos Amp, Sonos Architectural by Sonance, Control4, Crestron, Sonance'
    },
    better: {
      price: 27000,
      label: 'Entertainment Focused',
      tag: 'Better',
      features: [
        'Main living areas, kitchen, guest area(s), and master suite with music',
        'More speakers in living areas to eliminate loud spots during entertaining',
        'Premium in-ceiling speakers',
        'Automation system integration'
      ],
      brands: 'Sonos Amp, Sonos Architectural by Sonance, Control4, Crestron'
    },
    best: {
      price: 32000,
      label: 'Music Lover',
      tag: 'Best',
      features: [
        'Main living areas, kitchen, guest area(s), and master suite with music',
        'Ultra Premium in-ceiling speakers in main listening areas',
        'In ceiling/in wall subwoofer(s) in main listening area(s)',
        'Automation system integration'
      ],
      brands: 'Sonos Amp, Sonos Architectural by Sonance, Control4, Crestron, Monitor Audio, Sonance, B&W'
    }
  }
});

// -- Condo: Control & Automation --
condoOverride('control', {
  tiers: {
    good: {
      price: 9500,
      label: 'Automation Basic',
      tag: 'Good',
      features: [
        'Automation System Controller',
        'Single Remote and App control of main TVs',
        'Integration of installed components including lighting, music, and TVs',
        'Basic scenes (Morning, Night, Movie)'
      ],
      brands: 'Control4, Crestron'
    },
    better: {
      price: 16000,
      label: 'Automation Enhanced',
      tag: 'Better',
      features: [
        'Advanced Automation System Controller',
        'Single Remote and App control of main TVs',
        'Upgraded premium remotes',
        'Integration of installed, compatible components including lighting, shades, music, cameras, thermostats, and TVs',
        'Advanced scenes & scheduling'
      ],
      brands: 'Control4, Crestron'
    },
    best: {
      price: 29500,
      label: 'Full Automation',
      tag: 'Best',
      features: [
        'Advanced Automation System Controller',
        'Single Remote and App control of all TVs',
        'Upgraded premium remotes for main TVs',
        'Full integration of any installed, compatible components including lighting, shades, music, security, cameras, thermostats, and TVs',
        'Advanced scenes & scheduling'
      ],
      brands: 'Control4, Crestron'
    }
  }
});

// -- Condo: Video Wall Exterior → Balcony Video Wall --
condoOverride('videowall-exterior', {
  name: 'Video Wall Balcony/Terrace',
  desc: 'Weather-rated LED video wall for balcony or covered terrace',
});

// -- Condo: No extras section --
CONDO_EXTRAS.length = 0;

// ---- CONFIG MAP ----
const CONFIGS = {
  residential: { categories: RESIDENTIAL_CATEGORIES, extras: RESIDENTIAL_EXTRAS },
  condo: { categories: CONDO_CATEGORIES, extras: CONDO_EXTRAS }
};
