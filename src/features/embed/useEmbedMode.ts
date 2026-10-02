import { useEffect } from 'react';
import {
  isEmbedMode,
  postToParent,
  listenForParentMessages,
  parseEmbedParams,
} from './embed-protocol';
import type { InboundMessage } from './embed-protocol';
import {
  useConfiguratorStore,
  selectConfiguration,
  selectProductDefinition,
} from '../configurator/configurator.store';

/**
 * useEmbedMode — React hook that bridges the Zustand store with the
 * postMessage protocol when running in iframe embed mode.
 *
 * When embed mode is active:
 * - Sends CONFIGURATOR_READY on mount
 * - Forwards configuration changes to the parent
 * - Listens for parent SET_OPTION commands
 */
export function useEmbedMode(): { isEmbed: boolean } {
  const embed = isEmbedMode();
  const configuration = useConfiguratorStore(selectConfiguration);
  const productDef = useConfiguratorStore(selectProductDefinition);
  const setOption = useConfiguratorStore((s) => s.setOption);

  /* Send READY on mount */
  useEffect(() => {
    if (!embed || !productDef) return;

    postToParent({
      type: 'CONFIGURATOR_READY',
      version: '1.0.0',
      productId: productDef.id,
    });
  }, [embed, productDef]);

  /* Forward configuration changes */
  useEffect(() => {
    if (!embed || !configuration) return;

    postToParent({
      type: 'CONFIGURATION_CHANGED',
      configurationId: configuration.configurationId,
      options: configuration.options,
      sizeId: configuration.sizeId,
    });
  }, [embed, configuration]);

  /* Listen for parent commands */
  useEffect(() => {
    if (!embed) return;

    const params = parseEmbedParams();
    const cleanup = listenForParentMessages(
      (message: InboundMessage) => {
        switch (message.type) {
          case 'SET_OPTION':
            setOption(message.groupId, message.choiceId);
            break;
          case 'SET_CONFIGURATION':
            /* Could load a saved configuration from the server */
            break;
        }
      },
      params.origin,
    );

    return cleanup;
  }, [embed, setOption]);

  return { isEmbed: embed };
}
