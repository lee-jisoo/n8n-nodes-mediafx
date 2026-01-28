import { INodeProperties } from 'n8n-workflow';

export const probeProperties: INodeProperties[] = [
	// Probe Operations
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['probe'],
			},
		},
		options: [
			{
				name: 'Get Metadata',
				value: 'getMetadata',
				description: 'Extract metadata information from video or audio files',
			},
		],
		default: 'getMetadata',
	},

	// ===================
	// GET METADATA FIELDS
	// ===================
	{
		displayName: 'Media Source',
		name: 'probeSource',
		type: 'fixedCollection',
		placeholder: 'Add Media Source',
		displayOptions: {
			show: {
				resource: ['probe'],
				operation: ['getMetadata'],
			},
		},
		default: {},
		options: [
			{
				displayName: 'Source',
				name: 'source',
				values: [
					{
						displayName: 'Source Type',
						name: 'sourceType',
						type: 'options',
						options: [
							{
								name: 'URL',
								value: 'url',
							},
							{
								name: 'Binary Data from Previous Node',
								value: 'binary',
							},
						],
						default: 'url',
					},
					{
						displayName: 'Value',
						name: 'value',
						type: 'string',
						default: '',
						placeholder: 'https://example.com/video.mp4 or https://example.com/audio.mp3',
						description: 'URL of the media file to analyze',
						displayOptions: { show: { sourceType: ['url'] } },
					},
					{
						displayName: 'Binary Property',
						name: 'binaryProperty',
						type: 'string',
						default: 'data',
						description: 'Name of the binary property from the previous node',
						placeholder: 'e.g., data',
						displayOptions: { show: { sourceType: ['binary'] } },
					},
				],
			},
		],
		description: 'The media file (video or audio) to analyze',
	},
];
