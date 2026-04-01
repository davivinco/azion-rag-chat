/**
 * This file was automatically generated based on your preset configuration.
 *
 * For better type checking and IntelliSense:
 * 1. Install azion as dev dependency:
 *    npm install -D azion
 *
 * 2. Use defineConfig:
 *    import { defineConfig } from 'azion'
 *
 * 3. Replace the configuration with defineConfig:
 *    export default defineConfig({
 *      // Your configuration here
 *    })
 *
 * For more configuration options, visit:
 * https://github.com/aziontech/lib/tree/main/packages/config
 */

module.exports = {
  build: {
    preset: 'next',
    polyfills: true
  },
  storage: [
    {
      name: 'rag-chat-20260401234459',
      dir: '.edge/next-build-assets',
      workloadsAccess: 'read_only',
      prefix: '20260401234457'
    }
  ],
  connectors: [
    {
      name: 'azion-rag-chat-20260401234459',
      active: true,
      type: 'storage',
      attributes: {
        bucket: 'rag-chat-20260401234459',
        prefix: '20260401234457'
      }
    }
  ],
  functions: [
    {
      name: 'azion-rag-chat-20260401234459',
      path: './functions/handler.js',
      bindings: {
        storage: {
          bucket: 'rag-chat-20260401234459',
          prefix: '20260401234457'
        }
      }
    }
  ],
  applications: [
    {
      name: 'azion-rag-chat-20260401234459',
      cache: [
        {
          name: 'azion-rag-chat-20260401234459',
          browser: {
            maxAgeSeconds: 7200
          },
          edge: {
            maxAgeSeconds: 7200
          }
        }
      ],
      rules: {
        request: [
          {
            name: 'Next.js Static Assets and set cache policy',
            description:
              'Serve Next.js static assets through edge connector and set cache policy',
            active: true,
            criteria: [
              [
                {
                  variable: '${uri}',
                  conditional: 'if',
                  operator: 'matches',
                  argument: '^/_next/static/'
                }
              ]
            ],
            behaviors: [
              {
                type: 'set_connector',
                attributes: {
                  value: 'azion-rag-chat-20260401234459'
                }
              },
              {
                type: 'set_cache_policy',
                attributes: {
                  value: 'azion-rag-chat-20260401234459'
                }
              },
              {
                type: 'deliver'
              }
            ]
          },
          {
            name: 'Deliver Static Assets and set cache policy',
            description:
              'Serve static assets through edge connector and set cache policy',
            active: true,
            criteria: [
              [
                {
                  variable: '${uri}',
                  conditional: 'if',
                  operator: 'matches',
                  argument:
                    '.(css|js|ttf|woff|woff2|pdf|svg|jpg|jpeg|gif|bmp|png|ico|mp4|json|xml|html)$'
                }
              ]
            ],
            behaviors: [
              {
                type: 'set_connector',
                attributes: {
                  value: 'azion-rag-chat-20260401234459'
                }
              },
              {
                type: 'set_cache_policy',
                attributes: {
                  value: 'azion-rag-chat-20260401234459'
                }
              },
              {
                type: 'deliver'
              }
            ]
          },
          {
            name: 'Execute Next.js Function',
            description: 'Execute Next.js edge function for all requests',
            active: true,
            criteria: [
              [
                {
                  variable: '${uri}',
                  conditional: 'if',
                  operator: 'matches',
                  argument: '^/'
                }
              ]
            ],
            behaviors: [
              {
                type: 'run_function',
                attributes: {
                  value: 'azion-rag-chat-20260401234459'
                }
              },
              {
                type: 'forward_cookies'
              }
            ]
          }
        ]
      },
      functionsInstances: [
        {
          name: 'azion-rag-chat-20260401234459',
          ref: 'azion-rag-chat-20260401234459'
        }
      ]
    }
  ],
  workloads: [
    {
      name: 'azion-rag-chat-20260401234459',
      active: true,
      infrastructure: 1,
      deployments: [
        {
          name: 'azion-rag-chat-20260401234459',
          current: true,
          active: true,
          strategy: {
            type: 'default',
            attributes: {
              application: 'azion-rag-chat-20260401234459'
            }
          }
        }
      ]
    }
  ]
}
