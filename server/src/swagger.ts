import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import { Express } from 'express';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Acme Legal Triage API',
      version: '2.0.0',
      description: `
# AI-Powered Legal Triage System

An enterprise-grade API for intelligent routing of legal requests with:
- **AI-powered conversational triage**
- **Semantic search with vector embeddings**
- **Document RAG (Retrieval Augmented Generation)**
- **Employee context integration**
- **Email webhook routing**
- **Pattern learning and analytics**

## Features

### Level 1: Core
- Chat-based triage with streaming responses
- Configurable routing rules
- Natural language understanding

### Level 2: Foundation
- PostgreSQL database
- Fuzzy matching (40+ synonyms)
- Employee and lawyer profiles
- Conversation history

### Level 3: Advanced
- Vector embeddings (Pinecone)
- Document RAG system
- Email webhooks (SendGrid, Mailgun)
- Request pattern analysis
- Production logging & rate limiting

## Authentication

Currently, this API does not require authentication. In production, add:
- JWT tokens for API access
- API keys for webhook endpoints
- Role-based access control (RBAC)

## Rate Limits

- **Chat endpoint**: 20 requests/minute per IP
- **API endpoints**: 100 requests/minute per IP
- **Health check**: Unlimited

## Error Responses

All errors follow this format:

\`\`\`json
{
  "error": {
    "message": "Description of what went wrong",
    "type": "ErrorType",
    "details": ["field1 error", "field2 error"] // Optional
  }
}
\`\`\`

## Support

- Documentation: [GitHub README](https://github.com/acme/legal-triage)
- Issues: [GitHub Issues](https://github.com/acme/legal-triage/issues)
      `,
      contact: {
        name: 'Acme Legal Team',
        email: 'legal-tech@acme.corp'
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT'
      }
    },
    servers: [
      {
        url: 'http://localhost:8999',
        description: 'Development server'
      },
      {
        url: 'https://api.acme.corp',
        description: 'Production server'
      }
    ],
    tags: [
      {
        name: 'Core',
        description: 'Core triage functionality'
      },
      {
        name: 'Rules',
        description: 'Triage rule management'
      },
      {
        name: 'Documents',
        description: 'Document management and RAG'
      },
      {
        name: 'Employees',
        description: 'Employee context and profiles'
      },
      {
        name: 'Lawyers',
        description: 'Lawyer profiles and specialties'
      },
      {
        name: 'Email',
        description: 'Email webhook integration'
      },
      {
        name: 'System',
        description: 'System information and health'
      }
    ],
    components: {
      schemas: {
        Error: {
          type: 'object',
          properties: {
            error: {
              type: 'object',
              properties: {
                message: {
                  type: 'string',
                  example: 'Failed to process request'
                },
                type: {
                  type: 'string',
                  example: 'ValidationError'
                },
                details: {
                  type: 'array',
                  items: {
                    type: 'string'
                  },
                  example: ['name is required', 'email must be valid']
                }
              }
            }
          }
        },
        Message: {
          type: 'object',
          properties: {
            role: {
              type: 'string',
              enum: ['user', 'assistant', 'system'],
              example: 'user'
            },
            content: {
              type: 'string',
              example: 'I need help with a sales contract in Australia'
            }
          },
          required: ['role', 'content']
        },
        Condition: {
          type: 'object',
          properties: {
            field: {
              type: 'string',
              example: 'requestType'
            },
            operator: {
              type: 'string',
              enum: ['equals', 'contains'],
              example: 'equals'
            },
            value: {
              type: 'string',
              example: 'Sales Contract'
            }
          },
          required: ['field', 'operator', 'value']
        },
        TriageRule: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
              example: '123e4567-e89b-12d3-a456-426614174000'
            },
            name: {
              type: 'string',
              example: 'Sales Contracts - Australia'
            },
            conditions: {
              type: 'array',
              items: {
                $ref: '#/components/schemas/Condition'
              }
            },
            assignee: {
              type: 'string',
              format: 'email',
              example: 'john@acme.corp'
            },
            priority: {
              type: 'integer',
              minimum: 1,
              example: 1
            },
            enabled: {
              type: 'boolean',
              example: true
            }
          }
        },
        Document: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid'
            },
            title: {
              type: 'string',
              example: 'NDA Policy'
            },
            content: {
              type: 'string',
              example: 'All NDAs must be reviewed within 2 business days...'
            },
            category: {
              type: 'string',
              enum: ['policy', 'precedent', 'template', 'guide'],
              example: 'policy'
            },
            tags: {
              type: 'array',
              items: {
                type: 'string'
              },
              example: ['NDA', 'contracts', 'compliance']
            },
            metadata: {
              type: 'object'
            },
            createdAt: {
              type: 'string',
              format: 'date-time'
            },
            updatedAt: {
              type: 'string',
              format: 'date-time'
            }
          }
        },
        Employee: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid'
            },
            email: {
              type: 'string',
              format: 'email',
              example: 'alice.smith@acme.corp'
            },
            firstName: {
              type: 'string',
              example: 'Alice'
            },
            lastName: {
              type: 'string',
              example: 'Smith'
            },
            department: {
              type: 'string',
              example: 'Engineering'
            },
            location: {
              type: 'string',
              example: 'United States'
            },
            role: {
              type: 'string',
              example: 'Senior Engineer'
            }
          }
        },
        Lawyer: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid'
            },
            email: {
              type: 'string',
              format: 'email',
              example: 'john@acme.corp'
            },
            firstName: {
              type: 'string',
              example: 'John'
            },
            lastName: {
              type: 'string',
              example: 'Anderson'
            },
            specialties: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  skillType: {
                    type: 'string',
                    example: 'Sales Contract'
                  },
                  proficiency: {
                    type: 'integer',
                    minimum: 1,
                    maximum: 5,
                    example: 5
                  }
                }
              }
            },
            maxCaseLoad: {
              type: 'integer',
              example: 10
            },
            currentLoad: {
              type: 'integer',
              example: 3
            },
            available: {
              type: 'boolean',
              example: true
            }
          }
        },
        EmailRoute: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid'
            },
            fromEmail: {
              type: 'string',
              format: 'email'
            },
            subject: {
              type: 'string'
            },
            routedTo: {
              type: 'string',
              format: 'email'
            },
            confidence: {
              type: 'number',
              minimum: 0,
              maximum: 1,
              example: 0.95
            },
            status: {
              type: 'string',
              enum: ['pending', 'routed', 'failed'],
              example: 'routed'
            },
            createdAt: {
              type: 'string',
              format: 'date-time'
            }
          }
        }
      }
    }
  },
  apis: ['./src/indexNew.ts', './src/routes.ts']
};

const swaggerSpec = swaggerJsdoc(options);

export const setupSwagger = (app: Express): void => {
  // Swagger UI
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'Acme Legal Triage API',
    customfavIcon: '/favicon.ico'
  }));

  // Swagger JSON
  app.get('/api-docs.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpec);
  });

  console.log('📚 Swagger documentation available at /api-docs');
};

export default swaggerSpec;
