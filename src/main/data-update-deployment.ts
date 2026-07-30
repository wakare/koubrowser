export interface DataUpdateDeploymentValues {
  readonly manifestUrl: string | undefined
  readonly publicKey: string | undefined
  readonly publicKeySha256: string | undefined
}

export interface SelectedDataUpdateDeployment extends DataUpdateDeploymentValues {
  readonly source: 'bundled' | 'environment'
}

// Public release trust settings belong here after independent review.
// Never add a private key, token, credential, or authenticated URL.
export const bundledDataUpdateDeployment: DataUpdateDeploymentValues = {
  manifestUrl: undefined,
  publicKey: undefined,
  publicKeySha256: undefined
}

export function selectDataUpdateDeployment(
  environment: NodeJS.ProcessEnv,
  allowEnvironmentOverride: boolean,
  bundled: DataUpdateDeploymentValues = bundledDataUpdateDeployment
): SelectedDataUpdateDeployment {
  const environmentManifestUrl = environment.KOU_DATA_UPDATE_MANIFEST_URL
  const environmentPublicKey = environment.KOU_DATA_UPDATE_PUBLIC_KEY
  if (
    allowEnvironmentOverride &&
    (environmentManifestUrl !== undefined || environmentPublicKey !== undefined)
  ) {
    return {
      source: 'environment',
      manifestUrl: environmentManifestUrl,
      publicKey: environmentPublicKey,
      publicKeySha256: undefined
    }
  }
  return {
    source: 'bundled',
    ...bundled
  }
}
