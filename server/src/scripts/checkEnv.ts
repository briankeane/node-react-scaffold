import { requiredEnvVars } from '../config/envVars';

function findMissingEnvVars(): string[] {
  return requiredEnvVars.filter((envVar) => {
    const value = process.env[envVar];
    return value == null || value === '';
  });
}

export function ensureRequiredEnvVars(): void {
  const missingEnvVars = findMissingEnvVars();

  if (missingEnvVars.length > 0) {
    console.error('Missing required environment variables:');
    console.error('');
    for (const envVar of missingEnvVars) {
      console.error(`- ${envVar}`);
    }
    process.exit(1);
  }

  console.log('All required environment variables are set.');
}

if (require.main === module) {
  ensureRequiredEnvVars();
}
