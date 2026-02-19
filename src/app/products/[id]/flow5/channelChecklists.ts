export type GapType = 'FIXABLE_FAST' | 'FIXABLE_SLOW' | 'HARD_BLOCKER';

export type ChecklistItem = {
  id: string;
  label: string;
  gapType: GapType;
};

function fb(
  id: string,
  label: string,
  gapType: GapType
): ChecklistItem {
  return { id, label, gapType };
}

function tiktok(
  id: string,
  label: string,
  gapType: GapType
): ChecklistItem {
  return { id, label, gapType };
}

function organic(
  id: string,
  label: string,
  gapType: GapType
): ChecklistItem {
  return { id, label, gapType };
}

const FACEBOOK_ADS: ChecklistItem[] = [
  fb('fb_bm', 'Do you have Facebook Business Manager?', 'HARD_BLOCKER'),
  fb('fb_ad_account', 'Do you have an Ad account set up?', 'HARD_BLOCKER'),
  fb('fb_payment', 'Do you have a payment method linked?', 'HARD_BLOCKER'),
  fb('fb_image_ads', 'Can you create image ads (graphics/copy)?', 'FIXABLE_SLOW'),
];

const FACEBOOK_ORGANIC: ChecklistItem[] = [
  fb('fb_page', 'Do you have a Facebook Page or Group?', 'HARD_BLOCKER'),
  fb('fb_post', 'Can you post photos and short videos?', 'FIXABLE_FAST'),
  fb('fb_dm', 'Can you respond to DMs within 1 hour?', 'FIXABLE_FAST'),
];

const TIKTOK_ADS: ChecklistItem[] = [
  tiktok('tt_business', 'Do you have a TikTok Business account?', 'HARD_BLOCKER'),
  tiktok('tt_ads_manager', 'Do you have TikTok Ads Manager access?', 'HARD_BLOCKER'),
  tiktok('tt_video', 'Can you create 15–60 second videos?', 'FIXABLE_SLOW'),
];

const TIKTOK_ORGANIC: ChecklistItem[] = [
  tiktok('tt_account', 'Do you have a TikTok account?', 'HARD_BLOCKER'),
  tiktok('tt_content', 'Can you create 15–60 second videos regularly?', 'FIXABLE_SLOW'),
  tiktok('tt_respond', 'Can you respond to comments/DMs within a few hours?', 'FIXABLE_FAST'),
];

const LINE: ChecklistItem[] = [
  organic('line_oa', 'Do you have a LINE Official Account?', 'HARD_BLOCKER'),
  organic('line_post', 'Can you post updates and broadcast messages?', 'FIXABLE_FAST'),
  organic('line_dm', 'Can you respond to chats within 1 hour?', 'FIXABLE_FAST'),
];

const SHOPEE_LAZADA: ChecklistItem[] = [
  organic('shopee_store', 'Do you have a seller account (Shopee/Lazada)?', 'HARD_BLOCKER'),
  organic('shopee_listing', 'Can you create product listings with photos?', 'FIXABLE_FAST'),
  organic('shopee_cod', 'Is COD enabled for your area?', 'HARD_BLOCKER'),
];

const GENERIC_ORGANIC: ChecklistItem[] = [
  organic('gen_account', 'Does the account/channel exist?', 'HARD_BLOCKER'),
  organic('gen_post', 'Can you post photos or short content?', 'FIXABLE_FAST'),
  organic('gen_dm', 'Can you respond to messages within 1 hour?', 'FIXABLE_FAST'),
];

function channelKey(name: string): string {
  const n = name.toLowerCase();
  if (n.includes('facebook') && (n.includes('ad') || n.includes('ads'))) return 'facebook_ads';
  if (n.includes('facebook')) return 'facebook_organic';
  if (n.includes('tiktok') && (n.includes('ad') || n.includes('ads'))) return 'tiktok_ads';
  if (n.includes('tiktok')) return 'tiktok_organic';
  if (n.includes('line')) return 'line';
  if (n.includes('shopee') || n.includes('lazada')) return 'shopee_lazada';
  return 'generic';
}

const MAP: Record<string, ChecklistItem[]> = {
  facebook_ads: FACEBOOK_ADS,
  facebook_organic: FACEBOOK_ORGANIC,
  tiktok_ads: TIKTOK_ADS,
  tiktok_organic: TIKTOK_ORGANIC,
  line: LINE,
  shopee_lazada: SHOPEE_LAZADA,
  generic: GENERIC_ORGANIC,
};

export function getChecklistForChannel(channelName: string): ChecklistItem[] {
  const key = channelKey(channelName);
  return MAP[key] ?? GENERIC_ORGANIC;
}
