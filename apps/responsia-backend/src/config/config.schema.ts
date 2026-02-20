import * as Joi from 'joi'

export const configValidationSchema = Joi.object({
  // Database
  DATABASE_URL: Joi.string().required(),

  // Auth0
  AUTH_DISABLED: Joi.string().optional().default('false'),
  AUTH0_DOMAIN: Joi.string().when('AUTH_DISABLED', {
    is: 'true',
    then: Joi.optional(),
    otherwise: Joi.required(),
  }),
  AUTH0_AUDIENCE: Joi.string().when('AUTH_DISABLED', {
    is: 'true',
    then: Joi.optional(),
    otherwise: Joi.required(),
  }),

  // AI
  ANTHROPIC_API_KEY: Joi.string().optional().allow('').default(''),
  OPENAI_API_KEY: Joi.string().optional().allow('').default(''),

  // Azure Blob Storage
  AZURE_STORAGE_CONNECTION_STRING: Joi.string().optional().allow('').default(''),
  AZURE_STORAGE_CONTAINER: Joi.string().optional().default('responsia-documents'),

  // Azure Service Bus (empty = use local in-process queue)
  AZURE_SERVICE_BUS_CONNECTION_STRING: Joi.string().optional().allow('').default(''),

  // Azure Document Intelligence OCR (optional)
  AZURE_DI_ENDPOINT: Joi.string().optional().allow('').default(''),
  AZURE_DI_KEY: Joi.string().optional().allow('').default(''),

  // Server
  PORT: Joi.number().optional().default(3000),
  NODE_ENV: Joi.string().optional().default('development'),
  CORS_ORIGIN: Joi.string().optional().default('http://localhost:4200'),
})
