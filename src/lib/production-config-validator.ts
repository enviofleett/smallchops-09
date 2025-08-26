/**
 * Production Configuration Validator
 * Validates the entire application configuration for production readiness
 */

import { EnvironmentValidator } from './environment-validator';
import { ProductionValidator } from './production-checks';
import { errorLogger, ApplicationError, ErrorSeverity, ErrorCategory } from './error-handling';

export interface ProductionValidationResult {
  isReady: boolean;
  score: number;
  environment: {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  };
  productionChecks: {
    isReady: boolean;
    score: number;
    criticalIssues: string[];
    warnings: string[];
  };
  recommendations: string[];
}

class ProductionConfigValidator {
  static async validateForProduction(): Promise<ProductionValidationResult> {
    const startTime = performance.now();
    
    try {
      console.group('🔍 Production Configuration Validation');
      
      // 1. Validate environment variables
      console.log('⚙️ Validating environment configuration...');
      const envValidation = EnvironmentValidator.validateEnvironment();
      
      // 2. Run production checks
      console.log('🔧 Running production readiness checks...');
      const productionReadiness = await ProductionValidator.performFullCheck();
      
      // 3. Calculate overall score
      const envScore = envValidation.isValid ? 100 : 
        envValidation.errors.length === 0 ? 80 : 
        Math.max(0, 100 - (envValidation.errors.length * 20));
        
      const overallScore = Math.round((envScore + productionReadiness.score) / 2);
      
      // 4. Determine if ready for production
      const isReady = envValidation.isValid && 
                     productionReadiness.isReady && 
                     overallScore >= 80;
      
      // 5. Generate recommendations
      const recommendations = [
        ...envValidation.suggestions,
        ...(productionReadiness.score < 90 ? ['Improve production readiness score to 90% or higher'] : []),
        ...(envValidation.warnings.length > 0 ? ['Address environment configuration warnings'] : []),
        ...(productionReadiness.warnings.length > 0 ? ['Review production check warnings'] : [])
      ];
      
      const result: ProductionValidationResult = {
        isReady,
        score: overallScore,
        environment: {
          isValid: envValidation.isValid,
          errors: envValidation.errors,
          warnings: envValidation.warnings
        },
        productionChecks: {
          isReady: productionReadiness.isReady,
          score: productionReadiness.score,
          criticalIssues: productionReadiness.criticalIssues,
          warnings: productionReadiness.warnings
        },
        recommendations
      };
      
      // Log results
      const duration = performance.now() - startTime;
      console.log(`✅ Validation completed in ${duration.toFixed(2)}ms`);
      console.log(`📊 Overall Score: ${overallScore}%`);
      console.log(`🎯 Production Ready: ${isReady ? 'YES' : 'NO'}`);
      
      if (!isReady) {
        console.warn('⚠️ Issues found:');
        if (envValidation.errors.length > 0) {
          console.warn('Environment Errors:', envValidation.errors);
        }
        if (productionReadiness.criticalIssues.length > 0) {
          console.warn('Critical Issues:', productionReadiness.criticalIssues);
        }
      }
      
      if (recommendations.length > 0) {
        console.info('💡 Recommendations:', recommendations);
      }
      
      console.groupEnd();
      
      // Log validation result
      errorLogger.log(new ApplicationError(
        `Production validation completed: ${isReady ? 'READY' : 'NOT READY'} (Score: ${overallScore}%)`,
        'PRODUCTION_VALIDATION',
        isReady ? ErrorSeverity.LOW : ErrorSeverity.HIGH,
        ErrorCategory.SYSTEM,
        {
          isReady,
          score: overallScore,
          duration,
          environmentValid: envValidation.isValid,
          productionReady: productionReadiness.isReady,
          criticalIssues: productionReadiness.criticalIssues,
          environmentErrors: envValidation.errors
        }
      ));
      
      return result;
      
    } catch (error) {
      const duration = performance.now() - startTime;
      console.groupEnd();
      
      const validationError = new ApplicationError(
        `Production validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'PRODUCTION_VALIDATION_ERROR',
        ErrorSeverity.CRITICAL,
        ErrorCategory.SYSTEM,
        {
          duration,
          originalError: error,
          timestamp: new Date().toISOString()
        }
      );
      
      errorLogger.logCritical(validationError);
      
      // Return failure result
      return {
        isReady: false,
        score: 0,
        environment: {
          isValid: false,
          errors: ['Validation failed'],
          warnings: []
        },
        productionChecks: {
          isReady: false,
          score: 0,
          criticalIssues: ['Production validation error'],
          warnings: []
        },
        recommendations: ['Fix validation errors and try again']
      };
    }
  }

  static async validateAndWarn(): Promise<boolean> {
    const result = await this.validateForProduction();
    
    if (!result.isReady) {
      // In production, log critical warnings but don't block
      if (import.meta.env.PROD) {
        console.error('🚨 PRODUCTION ISSUES DETECTED 🚨');
        console.error('Score:', result.score + '%');
        console.error('Critical Issues:', result.productionChecks.criticalIssues);
        console.error('Environment Errors:', result.environment.errors);
        console.error('This application may not function correctly in production!');
      } else {
        // In development, show detailed information
        console.warn('🔧 Development Mode - Production Issues Detected:');
        console.table({
          'Overall Score': result.score + '%',
          'Environment Valid': result.environment.isValid ? '✅' : '❌',
          'Production Ready': result.productionChecks.isReady ? '✅' : '❌',
          'Critical Issues': result.productionChecks.criticalIssues.length,
          'Environment Errors': result.environment.errors.length
        });
        
        if (result.recommendations.length > 0) {
          console.info('💡 Recommendations to improve production readiness:');
          result.recommendations.forEach((rec, index) => {
            console.info(`${index + 1}. ${rec}`);
          });
        }
      }
    } else {
      console.log('✅ Production validation passed!');
    }
    
    return result.isReady;
  }

  static getProductionStatus(): 'ready' | 'warning' | 'critical' {
    const envValidation = EnvironmentValidator.validateEnvironment();
    
    if (!envValidation.isValid) {
      return 'critical';
    }
    
    if (envValidation.warnings.length > 0) {
      return 'warning';
    }
    
    return 'ready';
  }

  static generateProductionReport(): string {
    const envInfo = EnvironmentValidator.getEnvironmentInfo();
    const envValidation = EnvironmentValidator.validateEnvironment();
    
    const report = `
# Production Configuration Report
Generated: ${new Date().toISOString()}

## Environment Information
- Node Environment: ${envInfo.nodeEnv}
- Build Mode: ${envInfo.mode}
- Is Production: ${envInfo.isProduction}
- Custom Environment: ${envInfo.customEnvironment || 'Not set'}

## Service Configuration
- Supabase URL: ${envInfo.supabaseUrl}
- Paystack Key: ${envInfo.paystackKey}
- App URL: ${envInfo.appUrl}

## Validation Results
- Environment Valid: ${envValidation.isValid ? '✅' : '❌'}
- Errors: ${envValidation.errors.length}
- Warnings: ${envValidation.warnings.length}

${envValidation.errors.length > 0 ? `
### Errors
${envValidation.errors.map(error => `- ${error}`).join('\n')}
` : ''}

${envValidation.warnings.length > 0 ? `
### Warnings
${envValidation.warnings.map(warning => `- ${warning}`).join('\n')}
` : ''}

${envValidation.suggestions.length > 0 ? `
### Suggestions
${envValidation.suggestions.map(suggestion => `- ${suggestion}`).join('\n')}
` : ''}

---
Report generated by Production Configuration Validator
    `.trim();
    
    return report;
  }
}

export { ProductionConfigValidator };
export type { ProductionValidationResult };