import { INodeProperties } from 'n8n-workflow';

export const imageProperties: INodeProperties[] = [
	// Image Operations
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['image'],
			},
		},
		options: [
			{
				name: 'Add Text',
				value: 'addTextToImage',
				description: 'Overlay text onto an image',
			},
			{
				name: 'To Video',
				value: 'imageToVideo',
				description: 'Create a video from a static image for a specified duration',
			},
			{
				name: 'Stamp',
				value: 'stampImage',
				description: 'Overlay an image (stamp/watermark) onto a video',
			},
		],
		default: 'imageToVideo',
	},

	// =============================
	// == ADD TEXT TO IMAGE FIELDS ==
	// =============================
	{
		displayName: 'Source Image',
		name: 'sourceImageText',
		type: 'fixedCollection',
		placeholder: 'Add Image Source',
		displayOptions: {
			show: {
				resource: ['image'],
				operation: ['addTextToImage'],
			},
		},
		default: {},
		options: [
			{
				displayName: 'Source',
				name: 'source',
				values: [
					{
						displayName: 'Source Type', name: 'sourceType', type: 'options',
						options: [ { name: 'URL', value: 'url' }, { name: 'Binary Data', value: 'binary' } ],
						default: 'url',
					},
					{ displayName: 'Value', name: 'value', type: 'string', default: '', placeholder: 'https://example.com/image.png' , displayOptions: { show: { sourceType: ['url'] } }},
					{ displayName: 'Binary Property', name: 'binaryProperty', type: 'string', default: 'data' , displayOptions: { show: { sourceType: ['binary'] } }},
				],
			},
		],
	},
	{
		displayName: 'Text',
		name: 'imageText',
		type: 'string',
		default: 'Hello, n8n!',
		required: true,
		displayOptions: {
			show: {
				resource: ['image'],
				operation: ['addTextToImage'],
			},
		},
		description: 'The text to overlay on the image',
	},
	{
		displayName: 'Font',
		name: 'imageTextFontKey',
		type: 'options',
		typeOptions: {
			loadOptionsMethod: 'getFonts',
		},
		default: 'noto-sans-kr',
		displayOptions: {
			show: {
				resource: ['image'],
				operation: ['addTextToImage'],
			},
		},
		description: 'Select a font for the text',
	},
	{
		displayName: 'Font Size',
		name: 'imageTextSize',
		type: 'number',
		default: 48,
		typeOptions: {
			minValue: 1,
		},
		displayOptions: {
			show: {
				resource: ['image'],
				operation: ['addTextToImage'],
			},
		},
		description: 'Font size in pixels',
	},
	{
		displayName: 'Color',
		name: 'imageTextColor',
		type: 'string',
		default: 'white',
		displayOptions: {
			show: {
				resource: ['image'],
				operation: ['addTextToImage'],
			},
		},
		description: 'Text color (e.g., white, #FF0000, rgb(255,0,0))',
	},
	{
		displayName: 'Outline Width',
		name: 'imageTextOutlineWidth',
		type: 'number',
		default: 0,
		typeOptions: {
			minValue: 0,
		},
		displayOptions: {
			show: {
				resource: ['image'],
				operation: ['addTextToImage'],
			},
		},
		description: 'Width of the text outline/border in pixels. Set to 0 for no outline.',
	},
	{
		displayName: 'Outline Color',
		name: 'imageTextOutlineColor',
		type: 'string',
		default: 'black',
		displayOptions: {
			show: {
				resource: ['image'],
				operation: ['addTextToImage'],
			},
		},
		description: 'Color of the text outline/border',
	},
	{
		displayName: 'Enable Background Box',
		name: 'imageTextEnableBackground',
		type: 'boolean',
		default: false,
		displayOptions: {
			show: {
				resource: ['image'],
				operation: ['addTextToImage'],
			},
		},
		description: 'Whether to add a background box behind the text',
	},
	{
		displayName: 'Background Color',
		name: 'imageTextBackgroundColor',
		type: 'string',
		default: 'black',
		displayOptions: {
			show: {
				resource: ['image'],
				operation: ['addTextToImage'],
				imageTextEnableBackground: [true],
			},
		},
		description: 'Color of the background box',
	},
	{
		displayName: 'Background Opacity',
		name: 'imageTextBackgroundOpacity',
		type: 'number',
		default: 0.5,
		typeOptions: {
			minValue: 0,
			maxValue: 1,
			numberStepSize: 0.1,
		},
		displayOptions: {
			show: {
				resource: ['image'],
				operation: ['addTextToImage'],
				imageTextEnableBackground: [true],
			},
		},
		description: 'Opacity of the background box (0 = transparent, 1 = opaque)',
	},
	{
		displayName: 'Box Padding',
		name: 'imageTextBoxPadding',
		type: 'number',
		default: 5,
		typeOptions: {
			minValue: 0,
		},
		displayOptions: {
			show: {
				resource: ['image'],
				operation: ['addTextToImage'],
				imageTextEnableBackground: [true],
			},
		},
		description: 'Padding around the text inside the background box',
	},
	{
		displayName: 'Position Type',
		name: 'imageTextPositionType',
		type: 'options',
		options: [
			{ name: 'Alignment', value: 'alignment' },
			{ name: 'Custom', value: 'custom' },
		],
		default: 'alignment',
		displayOptions: {
			show: {
				resource: ['image'],
				operation: ['addTextToImage'],
			},
		},
		description: 'How to position the text on the image',
	},
	{
		displayName: 'Horizontal Alignment',
		name: 'imageTextHorizontalAlign',
		type: 'options',
		options: [
			{ name: 'Left', value: 'left' },
			{ name: 'Center', value: 'center' },
			{ name: 'Right', value: 'right' },
		],
		default: 'center',
		displayOptions: {
			show: {
				resource: ['image'],
				operation: ['addTextToImage'],
				imageTextPositionType: ['alignment'],
			},
		},
		description: 'Horizontal alignment of the text',
	},
	{
		displayName: 'Vertical Alignment',
		name: 'imageTextVerticalAlign',
		type: 'options',
		options: [
			{ name: 'Top', value: 'top' },
			{ name: 'Middle', value: 'middle' },
			{ name: 'Bottom', value: 'bottom' },
		],
		default: 'middle',
		displayOptions: {
			show: {
				resource: ['image'],
				operation: ['addTextToImage'],
				imageTextPositionType: ['alignment'],
			},
		},
		description: 'Vertical alignment of the text',
	},
	{
		displayName: 'Padding X',
		name: 'imageTextPaddingX',
		type: 'number',
		default: 20,
		displayOptions: {
			show: {
				resource: ['image'],
				operation: ['addTextToImage'],
				imageTextPositionType: ['alignment'],
			},
		},
		description: 'Horizontal padding from the edge in pixels',
	},
	{
		displayName: 'Padding Y',
		name: 'imageTextPaddingY',
		type: 'number',
		default: 20,
		displayOptions: {
			show: {
				resource: ['image'],
				operation: ['addTextToImage'],
				imageTextPositionType: ['alignment'],
			},
		},
		description: 'Vertical padding from the edge in pixels',
	},
	{
		displayName: 'Position X',
		name: 'imageTextX',
		type: 'string',
		default: '(w-text_w)/2',
		displayOptions: {
			show: {
				resource: ['image'],
				operation: ['addTextToImage'],
				imageTextPositionType: ['custom'],
			},
		},
		description: "X position. Supports FFmpeg expressions like '10', '(w-text_w)/2', 'w-text_w-10'.",
	},
	{
		displayName: 'Position Y',
		name: 'imageTextY',
		type: 'string',
		default: '(h-text_h)/2',
		displayOptions: {
			show: {
				resource: ['image'],
				operation: ['addTextToImage'],
				imageTextPositionType: ['custom'],
			},
		},
		description: "Y position. Supports FFmpeg expressions like '10', '(h-text_h)/2', 'h-th-10'.",
	},

	// =============================
	// == IMAGE TO VIDEO FIELDS ==
	// =============================
	{
		displayName: 'Source Image',
		name: 'sourceImage',
		type: 'fixedCollection',
		placeholder: 'Add Image Source',
		displayOptions: {
			show: {
				resource: ['image'],
				operation: ['imageToVideo'],
			},
		},
		default: {},
		options: [
			{
				displayName: 'Source',
				name: 'source',
				values: [
					{
						displayName: 'Source Type', name: 'sourceType', type: 'options',
						options: [ { name: 'URL', value: 'url' }, { name: 'Binary Data', value: 'binary' } ],
						default: 'url',
					},
					{ displayName: 'Value', name: 'value', type: 'string', default: '', placeholder: 'https://example.com/image.png' , displayOptions: { show: { sourceType: ['url'] } }},
					{ displayName: 'Binary Property', name: 'binaryProperty', type: 'string', default: 'data' , displayOptions: { show: { sourceType: ['binary'] } }},
				],
			},
		],
	},
	{
		displayName: 'Duration (seconds)',
		name: 'duration',
		type: 'number',
		default: 5,
		required: true,
		typeOptions: {
			minValue: 0.1,
		},
		displayOptions: {
			show: {
				resource: ['image'],
				operation: ['imageToVideo'],
			},
		},
		description: 'The duration of the output video in seconds',
	},
	{
		displayName: 'Video Size',
		name: 'videoSize',
		type: 'collection',
		placeholder: 'Add Size',
		default: {},
		displayOptions: {
			show: {
				resource: ['image'],
				operation: ['imageToVideo'],
			},
		},
		description: 'Specify the output video dimensions. Defaults to the image size.',
		options: [
			{
				displayName: 'Width',
				name: 'width',
				type: 'number',
				typeOptions: {
					minValue: 1,
				},
				default: 1920,
				description: 'Width of the video in pixels.',
			},
			{
				displayName: 'Height',
				name: 'height',
				type: 'number',
				typeOptions: {
					minValue: 1,
				},
				default: 1080,
				description: 'Height of the video in pixels.',
			},
		],
	},
	{
		displayName: 'Output Format',
		name: 'imageOutputFormat',
		type: 'options',
		displayOptions: {
			show: {
				resource: ['image'],
				operation: ['imageToVideo'],
			},
		},
		options: [ { name: 'MP4', value: 'mp4' } ],
		default: 'mp4',
	},

	// =============================
	// == STAMP IMAGE FIELDS ==
	// =============================
	{
		displayName: 'Source Video',
		name: 'sourceVideo',
		type: 'fixedCollection',
		placeholder: 'Add Video Source',
		displayOptions: {
			show: {
				resource: ['image'],
				operation: ['stampImage'],
			},
		},
		default: {},
		options: [
			{
				displayName: 'Source',
				name: 'source',
				values: [
					{
						displayName: 'Source Type', name: 'sourceType', type: 'options',
						options: [ { name: 'URL', value: 'url' }, { name: 'Binary Data', value: 'binary' } ],
						default: 'url',
					},
					{ displayName: 'Value', name: 'value', type: 'string', default: '', placeholder: 'https://example.com/video.mp4' , displayOptions: { show: { sourceType: ['url'] } }},
					{ displayName: 'Binary Property', name: 'binaryProperty', type: 'string', default: 'data' , displayOptions: { show: { sourceType: ['binary'] } }},
				],
			},
		],
	},
	{
		displayName: 'Stamp Image',
		name: 'stampImage',
		type: 'fixedCollection',
		placeholder: 'Add Stamp Image Source',
		displayOptions: {
			show: {
				resource: ['image'],
				operation: ['stampImage'],
			},
		},
		default: {},
		options: [
			{
				displayName: 'Source',
				name: 'source',
				values: [
					{
						displayName: 'Source Type', name: 'sourceType', type: 'options',
						options: [ { name: 'URL', value: 'url' }, { name: 'Binary Data', value: 'binary' } ],
						default: 'url',
					},
					{ displayName: 'Value', name: 'value', type: 'string', default: '', placeholder: 'https://example.com/stamp.png' , displayOptions: { show: { sourceType: ['url'] } }},
					{ displayName: 'Binary Property', name: 'binaryProperty', type: 'string', default: 'data' , displayOptions: { show: { sourceType: ['binary'] } }},
				],
			},
		],
	},

	// =============================
	// == STAMP OPTIONS (Individual Properties) ==
	// =============================
	
	// Size Options
	{
		displayName: 'Width (pixels)',
		name: 'width',
		type: 'number',
		default: 150,
		displayOptions: {
			show: {
				resource: ['image'],
				operation: ['stampImage'],
			},
		},
		description: 'Width of the stamp image. Use -1 to keep aspect ratio.',
	},
	{
		displayName: 'Height (pixels)',
		name: 'height',
		type: 'number',
		default: -1,
		displayOptions: {
			show: {
				resource: ['image'],
				operation: ['stampImage'],
			},
		},
		description: 'Height of the stamp image. Use -1 to keep aspect ratio.',
	},
	
	// Position Options
	{
		displayName: 'Position X',
		name: 'x',
		type: 'string',
		default: '10',
		displayOptions: {
			show: {
				resource: ['image'],
				operation: ['stampImage'],
			},
		},
		description: "Position from left. E.g., '10' (pixels) or '(main_w-overlay_w)-10' (right align).",
	},
	{
		displayName: 'Position Y',
		name: 'y',
		type: 'string',
		default: '10',
		displayOptions: {
			show: {
				resource: ['image'],
				operation: ['stampImage'],
			},
		},
		description: "Position from top. E.g., '10' (pixels) or '(main_h-overlay_h)-10' (bottom align).",
	},
	{
		displayName: 'Rotation (degrees)',
		name: 'rotation',
		type: 'number',
		default: 0,
		displayOptions: {
			show: {
				resource: ['image'],
				operation: ['stampImage'],
			},
		},
		description: 'Rotation angle of the stamp in degrees (clockwise).',
	},
	
	// Time Control Options
	{
		displayName: 'Enable Time Control',
		name: 'enableTimeControl',
		type: 'boolean',
		default: false,
		displayOptions: {
			show: {
				resource: ['image'],
				operation: ['stampImage'],
			},
		},
		description: 'Control when the stamp appears and disappears',
	},
	{
		displayName: 'Start Time (seconds)',
		name: 'startTime',
		type: 'number',
		default: 0,
		displayOptions: {
			show: {
				resource: ['image'],
				operation: ['stampImage'],
				enableTimeControl: [true],
			},
		},
		description: 'When the stamp should start appearing',
	},
	{
		displayName: 'End Time (seconds)',
		name: 'endTime',
		type: 'number',
		default: 5,
		displayOptions: {
			show: {
				resource: ['image'],
				operation: ['stampImage'],
				enableTimeControl: [true],
			},
		},
		description: 'When the stamp should stop appearing. Leave empty for entire video duration.',
	},
	

	
	// Opacity Control
	{
		displayName: 'Opacity',
		name: 'opacity',
		type: 'number',
		default: 1.0,
		typeOptions: {
			minValue: 0,
			maxValue: 1,
			numberStepSize: 0.1,
		},
		displayOptions: {
			show: {
				resource: ['image'],
				operation: ['stampImage'],
			},
		},
		description: 'Opacity of the stamp (0.0 = transparent, 1.0 = opaque)',
	},
	
	// ===================
	// OUTPUT FIELD NAME
	// ===================
	{
		displayName: 'Output Field Name',
		name: 'outputFieldName',
		type: 'string',
		displayOptions: {
			show: {
				resource: ['image'],
			},
		},
		default: 'data',
		description: 'Name of the binary property where the output video will be stored',
		placeholder: 'data',
	},
]; 