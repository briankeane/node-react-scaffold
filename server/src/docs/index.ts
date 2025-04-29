import { Application } from 'express';
import fs from 'fs';
import path from 'path';
import redocExpress from 'redoc-express';
import swaggerJsdoc from 'swagger-jsdoc';

let apiGuideMarkdownDescription = '';
try {
  const apiGuidePath = path.join(__dirname, 'API_GUIDE.md');
  apiGuideMarkdownDescription = fs.readFileSync(apiGuidePath, 'utf8');
} catch (error) {
  console.warn('API_GUIDE.md not found, using default description', error);
  apiGuideMarkdownDescription =
    'This is a REST API designed to program live, 24-hr radio stations.';
}

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'API Documentation',
      version: '1.0.0',
      description: apiGuideMarkdownDescription,
      contact: {
        name: 'API Support',
        email: 'support@example.com',
      },
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Development server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
  },
  apis: [
    './src/routes/*.ts',
    // API documentation and YAML files
    path.join(__dirname, '../api/**/*.api.docs.yaml'),
    // Schema files from docs folder
    path.join(__dirname, './**/*.yaml'),
  ], // Path to the API routes
};

const swaggerSpec = swaggerJsdoc(options);

function addDocRoutes(app: Application) {
  app.get('/api-docs', (req, res) => {
    res.json(swaggerSpec);
  });

  // ReDoc routes
  app.use(
    '/docs',
    redocExpress({
      title: 'API Documentation',
      specUrl: '/swagger.json',
      redocOptions: {
        theme: {
          colors: {
            primary: {
              main: '#1976d2', // Match primary color from client
            },
          },
        },
        logo: {
          gutter: '20px', // Add some spacing around the logo
        },
      },
    })
  );

  // Serve the raw JSON spec for debugging and for ReDoc to consume
  app.get('/swagger.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpec);
  });
}

export default addDocRoutes;
