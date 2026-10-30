export type TemplateId = 'old-home' | 'station' | 'classroom';
export type AnchorId = 'tv' | 'doll' | 'photo';
export type Branch = 'real' | 'imagined';
export type NavigationMode='walk'|'third-person'|'overview';
export interface StoryClockRef {current:{time:number;playing:boolean;revision:number}}
export type CharacterPreset='young-man'|'elder-man'|'young-woman'|'elder-woman';
export type RoomZone='living'|'kitchen'|'balcony'|'bedroom'|'study'|'concourse'|'platform'|'carriage'|'classroom'|'corridor';
export type Phase = 'landing'|'memory-room'|'template-select'|'memory-input'|'memory-confirm'|'transition-in'|'exploration'|'decision'|'real-branch'|'imagined-branch'|'letter'|'transition-out'|'return-room'|'collection';
export interface Draft { templateId: TemplateId; year: string; place: string; importantPerson: string; importantObject: string; storyText: string; actualChoice: string; }
export interface Story { mode: string; templateId: TemplateId; scenePreset: string; title: string; facts: { year:string;place:string;person:string;object:string;actualChoice:string }; anchors: {id:AnchorId;assetId:string;narration:string}[]; decision: {question:string;real:{label:string;script:string[]};imagined:{label:string;disclaimer:string;script:string[]}}; letterPrompt:string; ending:string; }
export interface CollectionEntry { id:string; clientId?:string; memoryId?:string; title:string; draft:Draft; story:Story; branch:Branch; recipient:string; text:string; createdAt:string; synced:boolean; }
export interface Experience { phase:Phase; draft:Draft; story:Story|null; visited:AnchorId[]; branch:Branch|null; letterText:string;recipient:string;memoryId?:string; }
export interface SceneProps { world:'present'|'memory'; templateId?:TemplateId; phase:Phase; visited:AnchorId[]; selected:AnchorId|null; branch:Branch|null; collected:boolean; hint:boolean; resetKey:number; reducedMotion:boolean; realDeparture?:boolean; viewMode?:NavigationMode; companion?:CharacterPreset; playerAvatar?:CharacterPreset; previewPlayer?:boolean; characterPreview?:boolean; navigationPaused?:boolean; storyTime?:number; storyPlaying?:boolean; storyClock?:StoryClockRef; moveIntent?:{forward:number;right:number}; onZoneChange?:(zone:RoomZone)=>void; onAnchor:(id:AnchorId)=>void; onBox:()=>void; onReady?:()=>void; onWorldReady?:()=>void; }
