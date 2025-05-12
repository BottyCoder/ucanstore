
const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'SendWA API Documentation',
      version: '1.0.0',
      description: 'API for sending WhatsApp messages through Botforce integration',
    },
    servers: [
      {
        url: 'https://ucanaiaws.botforce.co.za',
        description: 'Production server',
      }
    ],
    components: {
      securitySchemes: {
        ApiKeyAuth: {
          type: 'apiKey',
          in: 'header',
          name: 'x-api-key',
          description: 'API key for authentication (Required)'
        }
      }
    },
    paths: {
      '/sendwa': {
        post: {
          tags: ['WhatsApp'],
          summary: 'Send WhatsApp Message',
          description: 'Sends a WhatsApp message to a specified phone number',
          security: [{ ApiKeyAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['phoneNumber', 'message'],
                  properties: {
                    phoneNumber: {
                      type: 'string',
                      description: 'Recipient phone number with country code',
                      example: '+27824537125'
                    },
                    message: {
                      type: 'string',
                      description: 'Message content to send',
                      example: 'Hello from the API!'
                    },
                    customerName: {
                      type: 'string',
                      description: 'Optional customer name',
                      example: 'John Doe'
                    },
                    trackingCode: {
                      type: 'string',
                      description: 'Optional tracking code for message',
                      example: 'order-123'
                    }
                  }
                }
              }
            }
          },
          responses: {
            '200': {
              description: 'Message sent successfully',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: {
                        type: 'boolean',
                        example: true
                      },
                      tracking_code: {
                        type: 'string',
                        example: 'order-123'
                      },
                      wa_id: {
                        type: 'string',
                        example: '18364f52-2731-4aae-a588-2fa3123ea7b9'
                      },
                      wamid: {
                        type: 'string',
                        example: 'wamid.HBgLMjc4MjQ1MzcxMjUVAgARGBI5M0M5OUE4RDgwMDM2NjlGNEIA'
                      }
                    }
                  }
                }
              }
            },
            '400': {
              description: 'Invalid request parameters'
            },
            '401': {
              description: 'Invalid API key'
            },
            '429': {
              description: 'Rate limit exceeded (100 requests per 15 minutes)'
            },
            '500': {
              description: 'Server error'
            }
          }
        }
      }
    }
  },
  apis: ['./routes/sendwa.js'],
};

const specs = swaggerJsdoc(options);
module.exports = specs;
