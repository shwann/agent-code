import { isComputerUseFeatureEnabled } from '../../utils/computerUse/common.js'

export type FeatureFlags = {
  computerUse: boolean
}

export function getFeatureFlags(): FeatureFlags {
  return {
    computerUse: isComputerUseFeatureEnabled(),
  }
}
