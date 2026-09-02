metadata description = 'Imaging Center Onboarding dashboard — Container Apps (scale to zero) plus an hourly refresh job.'

@description('Azure region.')
param location string = resourceGroup().location

@description('Prefix for every resource name. Lowercase letters and digits only.')
@minLength(3)
@maxLength(12)
param namePrefix string = 'imgcenter'

@description('Entra ID tenant the dashboard is restricted to.')
param tenantId string = subscription().tenantId

@description('Application (client) ID of the Entra app registration used for sign-in.')
param aadClientId string

@description('Client secret of that app registration.')
@secure()
param aadClientSecret string

@description('ClickUp API token. Stored in Key Vault; the job reads it with the managed identity.')
@secure()
param clickUpToken string

@description('ClickUp list id — "Imaging Center Onboarding".')
param clickUpListId string = '901316440634'

@description('Container image tag. The deploy workflow passes the commit SHA.')
param imageTag string = 'latest'

@description('Cron for the refresh job, in UTC. Hourly on the hour by default.')
param refreshCron string = '0 * * * *'

var suffix = uniqueString(resourceGroup().id)
var storageAccountName = toLower('st${namePrefix}${take(suffix, 6)}')
var keyVaultName = toLower('kv-${take(namePrefix, 8)}-${take(suffix, 6)}')
var registryName = toLower('cr${namePrefix}${take(suffix, 6)}')
var identityName = 'id-${namePrefix}'
var environmentName = 'cae-${namePrefix}'
var appName = 'ca-${namePrefix}'
var jobName = 'caj-${namePrefix}-refresh'
var blobContainerName = 'dashboard'
var snapshotTableName = 'weeklysnapshots'
var imageName = 'imaging-center-dashboard'

var blobDataContributor = 'ba92f5b4-2d11-453d-a403-e96b0029c9fe'
var tableDataContributor = '0a9a7e1f-b9d0-4cc4-a60d-0319b160aaa3'
var keyVaultSecretsUser = '4633458b-17de-408a-b874-0445c86b69e6'
var acrPull = '7f951dda-4ed3-4680-a7ca-43fe172d538d'

// One identity shared by the web app and the refresh job: both read the same
// storage, and the job additionally reads the token from Key Vault.
resource identity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: identityName
  location: location
}

resource registry 'Microsoft.ContainerRegistry/registries@2023-11-01-preview' = {
  name: registryName
  location: location
  sku: {
    name: 'Basic'
  }
  properties: {
    adminUserEnabled: false
  }
}

resource storage 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: storageAccountName
  location: location
  sku: {
    name: 'Standard_LRS'
  }
  kind: 'StorageV2'
  properties: {
    // The payload is served through the app, never from a public blob URL.
    allowBlobPublicAccess: false
    allowSharedKeyAccess: false
    minimumTlsVersion: 'TLS1_2'
    supportsHttpsTrafficOnly: true
  }
}

resource blobService 'Microsoft.Storage/storageAccounts/blobServices@2023-05-01' = {
  parent: storage
  name: 'default'
}

resource dashboardContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-05-01' = {
  parent: blobService
  name: blobContainerName
  properties: {
    publicAccess: 'None'
  }
}

resource tableService 'Microsoft.Storage/storageAccounts/tableServices@2023-05-01' = {
  parent: storage
  name: 'default'
}

// Weekly snapshots. Without these there is no "last week" status, no
// new-this-week count, and no planned-vs-actual comparison.
resource snapshotTable 'Microsoft.Storage/storageAccounts/tableServices/tables@2023-05-01' = {
  parent: tableService
  name: snapshotTableName
}

resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: keyVaultName
  location: location
  properties: {
    tenantId: tenantId
    sku: {
      family: 'A'
      name: 'standard'
    }
    enableRbacAuthorization: true
    enableSoftDelete: true
    softDeleteRetentionInDays: 90
  }
}

resource clickUpSecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'clickup-token'
  properties: {
    value: clickUpToken
    contentType: 'ClickUp API token (move to a service account before launch)'
  }
}

resource logs 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: 'log-${namePrefix}'
  location: location
  properties: {
    sku: {
      name: 'PerGB2018'
    }
    retentionInDays: 30
  }
}

resource environment 'Microsoft.App/managedEnvironments@2024-03-01' = {
  name: environmentName
  location: location
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: logs.properties.customerId
        sharedKey: logs.listKeys().primarySharedKey
      }
    }
  }
}

var sharedEnv = [
  {
    name: 'DASHBOARD_STORAGE_ACCOUNT'
    value: storage.name
  }
  {
    name: 'DASHBOARD_BLOB_CONTAINER'
    value: blobContainerName
  }
  {
    name: 'DASHBOARD_SNAPSHOT_TABLE'
    value: snapshotTableName
  }
  {
    name: 'AZURE_CLIENT_ID'
    value: identity.properties.clientId
  }
]

resource app 'Microsoft.App/containerApps@2024-03-01' = {
  name: appName
  location: location
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${identity.id}': {}
    }
  }
  properties: {
    managedEnvironmentId: environment.id
    configuration: {
      ingress: {
        external: true
        targetPort: 8080
        transport: 'auto'
        allowInsecure: false
      }
      registries: [
        {
          server: registry.properties.loginServer
          identity: identity.id
        }
      ]
      secrets: [
        {
          name: 'aad-client-secret'
          value: aadClientSecret
        }
      ]
    }
    template: {
      containers: [
        {
          name: 'web'
          image: '${registry.properties.loginServer}/${imageName}:${imageTag}'
          resources: {
            cpu: json('0.5')
            memory: '1Gi'
          }
          env: sharedEnv
          probes: [
            {
              type: 'Readiness'
              httpGet: {
                path: '/healthz'
                port: 8080
              }
              initialDelaySeconds: 2
              periodSeconds: 10
            }
          ]
        }
      ]
      scale: {
        // Scale to zero: nobody looks at this outside the Monday meeting and
        // the odd mid-week check. Cold start costs a couple of seconds.
        minReplicas: 0
        maxReplicas: 2
        rules: [
          {
            name: 'http'
            http: {
              metadata: {
                concurrentRequests: '20'
              }
            }
          }
        ]
      }
    }
  }
  dependsOn: [
    acrPullRole
  ]
}

// Internal pipeline data with customer names, IT contacts and ticket numbers.
// Every request must carry an Entra ID identity from this tenant.
resource authConfig 'Microsoft.App/containerApps/authConfigs@2024-03-01' = {
  parent: app
  name: 'current'
  properties: {
    platform: {
      enabled: true
    }
    globalValidation: {
      unauthenticatedClientAction: 'RedirectToLoginPage'
      redirectToProvider: 'azureactivedirectory'
      excludedPaths: [
        '/healthz'
      ]
    }
    identityProviders: {
      azureActiveDirectory: {
        enabled: true
        registration: {
          openIdIssuer: '${az.environment().authentication.loginEndpoint}${tenantId}/v2.0'
          clientId: aadClientId
          clientSecretSettingName: 'aad-client-secret'
        }
        validation: {
          allowedAudiences: [
            'api://${aadClientId}'
          ]
          defaultAuthorizationPolicy: {
            allowedApplications: [
              aadClientId
            ]
          }
        }
      }
    }
    login: {
      preserveUrlFragmentsForLogins: true
    }
  }
}

// The hourly refresh. A job rather than a timer inside the web container,
// because a scale-to-zero app has no process running most of the time.
resource refreshJob 'Microsoft.App/jobs@2024-03-01' = {
  name: jobName
  location: location
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${identity.id}': {}
    }
  }
  properties: {
    environmentId: environment.id
    configuration: {
      triggerType: 'Schedule'
      scheduleTriggerConfig: {
        cronExpression: refreshCron
        parallelism: 1
        replicaCompletionCount: 1
      }
      // ClickUp is 29 requests at today's volume; five minutes is generous.
      replicaTimeout: 600
      replicaRetryLimit: 1
      registries: [
        {
          server: registry.properties.loginServer
          identity: identity.id
        }
      ]
    }
    template: {
      containers: [
        {
          name: 'refresh'
          image: '${registry.properties.loginServer}/${imageName}:${imageTag}'
          command: [
            'node'
          ]
          args: [
            'dist/api/src/refresh-job.js'
          ]
          resources: {
            cpu: json('0.5')
            memory: '1Gi'
          }
          env: concat(sharedEnv, [
            {
              name: 'CLICKUP_TOKEN_SECRET_URI'
              value: clickUpSecret.properties.secretUri
            }
            {
              name: 'CLICKUP_LIST_ID'
              value: clickUpListId
            }
          ])
        }
      ]
    }
  }
  dependsOn: [
    acrPullRole
  ]
}

resource acrPullRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  scope: registry
  name: guid(registry.id, identity.id, acrPull)
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', acrPull)
    principalId: identity.properties.principalId
    principalType: 'ServicePrincipal'
  }
}

resource blobRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  scope: storage
  name: guid(storage.id, identity.id, blobDataContributor)
  properties: {
    roleDefinitionId: subscriptionResourceId(
      'Microsoft.Authorization/roleDefinitions',
      blobDataContributor
    )
    principalId: identity.properties.principalId
    principalType: 'ServicePrincipal'
  }
}

resource tableRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  scope: storage
  name: guid(storage.id, identity.id, tableDataContributor)
  properties: {
    roleDefinitionId: subscriptionResourceId(
      'Microsoft.Authorization/roleDefinitions',
      tableDataContributor
    )
    principalId: identity.properties.principalId
    principalType: 'ServicePrincipal'
  }
}

resource keyVaultRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  scope: keyVault
  name: guid(keyVault.id, identity.id, keyVaultSecretsUser)
  properties: {
    roleDefinitionId: subscriptionResourceId(
      'Microsoft.Authorization/roleDefinitions',
      keyVaultSecretsUser
    )
    principalId: identity.properties.principalId
    principalType: 'ServicePrincipal'
  }
}

output appUrl string = 'https://${app.properties.configuration.ingress.fqdn}'
output registryLoginServer string = registry.properties.loginServer
output imageRepository string = imageName
output refreshJobName string = refreshJob.name
output storageAccountName string = storage.name
output keyVaultName string = keyVault.name
output managedIdentityClientId string = identity.properties.clientId
