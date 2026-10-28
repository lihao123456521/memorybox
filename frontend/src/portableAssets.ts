import { DefaultLoadingManager } from 'three';

declare global {
  interface Window {
    __MEMORYBOX_ASSETS__?:Record<string,string>;
    __MEMORYBOX_PORTABLE__?:{version:string;assetCount:number;builtAt:string;mode:string};
  }
}

/** Called before React mounts. Normal HTTP builds keep their existing local asset paths. */
export function setupPortableAssets() {
  const assets=window.__MEMORYBOX_ASSETS__;
  if(!assets)return;
  DefaultLoadingManager.setURLModifier(url=>{
    if(url.startsWith('data:')||url.startsWith('blob:'))return url;
    if(assets[url])return assets[url];
    try {
      const path=decodeURIComponent(new URL(url,window.location.href).pathname);
      const marker=path.indexOf('/assets/');
      if(marker>=0){const asset=assets[path.slice(marker)];if(asset)return asset;}
    } catch { /* Non-URL loader identifiers fall back to the original resolver. */ }
    return url;
  });
}
