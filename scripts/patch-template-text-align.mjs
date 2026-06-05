#!/usr/bin/env node
/**
 * Adds default textAlign to template element properties for builder / saved-email merge.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dir = path.join(__dirname, '../src/assets/dynamicEmailTemplates');

const PATCHES = {
  'ecom_checkout_email.json': {
    center: ['heading_main_1', 'heading_section_1', 'heading_checkout_cta', 'text_checkout_subheading', 'button_1'],
  },
  'ecom_order_confirmation.json': {
    center: ['heading_main_1', 'heading_section_1', 'text_order_date'],
  },
  'ecom_new_products.json': {
    center: [
      'heading_main_1',
      'text_header_subhead',
      'heading_section_1',
      'text_hero_description',
      'heading_sub_1',
      'text_arrival_1_title',
      'text_arrival_1_description',
      'text_arrival_2_title',
      'text_arrival_2_description',
      'text_arrival_3_title',
      'text_arrival_3_description',
      'text_arrival_4_title',
      'text_arrival_4_description',
    ],
  },
  'ecom_promotional_1.json': {
    center: [
      'text_header_sale_banner',
      'heading_main_1',
      'heading_section_1',
      'heading_section_2',
      'text_sale_hero_description',
      'text_deal_1_title',
      'text_deal_2_title',
    ],
  },
  'ecom_back_in_stock.json': {
    center: [
      'heading_main_1',
      'heading_sub_header',
      'heading_sub_product',
      'text_product_description',
      'heading_sub_stock',
    ],
  },
  'ecom_product_recommendations_horizontal.json': {
    center: [
      'heading_header_title',
      'text_header_subhead',
      'heading_recommendations',
      'text_recommendations_description',
    ],
  },
  'freeflow_welcome.json': {
    center: ['heading_main_1', 'text_header_subhead', 'heading_section_1', 'text_welcome_description'],
  },
  'freeflow_product_launch.json': {
    center: [
      'heading_header_kicker',
      'heading_main_1',
      'text_launch_subtitle',
      'heading_sub_1',
      'text_feature_1_description',
      'heading_sub_2',
      'text_feature_2_description',
      'heading_sub_3',
      'text_feature_3_description',
    ],
  },
  'freeflow_newsletter.json': {
    center: [
      'text_header_tagline',
      'heading_section_1',
      'text_featured_body',
      'text_featured_insight',
      'heading_sub_1',
      'text_trending_subhead',
      'heading_topic_1',
      'text_topic_1_description',
      'heading_topic_2',
      'text_topic_2_description',
      'heading_topic_3',
      'text_topic_3_description',
      'heading_topic_4',
      'text_topic_4_description',
      'heading_sub_2',
      'text_quick_subhead',
      'heading_quick_1',
      'text_quick_1_summary',
      'heading_quick_2',
      'text_quick_2_summary',
      'heading_quick_3',
      'text_quick_3_summary',
      'read_more_1',
      'read_more_2',
      'read_more_3',
    ],
  },
  'freeflow_event_invite.json': {
    center: ['heading_main_1', 'text_header_subtitle', 'heading_section_1', 'text_event_tagline'],
  },
  'freeflow_feature_announce.json': {
    center: [
      'heading_header_title',
      'text_header_subtitle',
      'heading_overview',
      'text_overview_description',
      'heading_getting_started',
      'text_getting_started_highlight',
      'text_getting_started_instructions',
    ],
    left: [
      'heading_feature_1_title',
      'text_feature_1_description',
      'heading_feature_2_title',
      'text_feature_2_description',
      'heading_feature_3_title',
      'text_feature_3_description',
    ],
  },
  'freeflow_thank_you.json': {
    center: ['heading_header_title', 'text_main_body', 'heading_gift', 'text_gift_body', 'button_gift_cta'],
  },
  'freeflow_image_powered.json': {
    center: ['heading_header_title', 'text_header_subhead', 'heading_cta', 'text_cta_description', 'button_cta'],
  },
  'freeflow_survey.json': {
    center: ['heading_header_title', 'text_survey_description', 'button_survey_cta'],
  },
};

function patchFile(filename) {
  const spec = PATCHES[filename];
  if (!spec) return 0;
  const fp = path.join(dir, filename);
  const data = JSON.parse(fs.readFileSync(fp, 'utf8'));
  let n = 0;
  const center = new Set(spec.center || []);
  const left = new Set(spec.left || []);
  for (const el of data.elements || []) {
    let ta = null;
    if (center.has(el.id)) ta = 'center';
    if (left.has(el.id)) ta = 'left';
    if (!ta) continue;
    el.properties = { ...(el.properties || {}), textAlign: ta };
    n++;
  }
  fs.writeFileSync(fp, JSON.stringify(data, null, 2) + '\n');
  return n;
}

let total = 0;
for (const f of Object.keys(PATCHES)) {
  const c = patchFile(f);
  console.log(`${f}: ${c} elements`);
  total += c;
}
console.log(`Done. ${total} total.`);
