/**
 * Wuthering Waves Intelligent Team Recommender
 * Evaluates user-owned Resonator roster and synthesizes optimal 3-character team compositions
 * based on verified role balance, Outro Concerto synergies, and elemental harmony.
 */

import {
  CANONICAL_SIGNATURE_WEAPONS,
  HEALER_RESONATORS,
  BUFFER_RESONATORS,
} from '../inventory/default-builds.ts';
import { CANONICAL_RESONATOR_METADATA } from '../engine/character-build-evaluation/rules.ts';

export function getRecommendedSonataName(resonatorId: string, element: string): string {
  if (HEALER_RESONATORS.has(resonatorId)) return 'Rejuvenating Glow';
  if (BUFFER_RESONATORS.has(resonatorId)) return 'Moonlit Clouds';
  switch (element) {
    case 'Glacio': return 'Freezing Frost';
    case 'Fusion': return 'Molten Rift';
    case 'Electro': return 'Void Thunder';
    case 'Aero': return 'Sierra Gale';
    case 'Spectro': return 'Celestial Light';
    case 'Havoc': return 'Sun-sinking Eclipse';
    default: return 'Moonlit Clouds';
  }
}

export type TeamArchetype = 'HYPERCARRY' | 'QUICKSWAP_DUAL_CARRY' | 'ELEMENTAL_SYNERGY';

export type CharacterRole = 'MAIN_DPS' | 'SUB_DPS' | 'SUSTAINER';

export interface RecommendedTeamMember {
  resonatorId: string;
  name: string;
  role: CharacterRole;
  roleLabel: string;
  roleColor: string;
  element: string;
  rarity: number;
  recommendedWeaponName: string;
  recommendedSonataName: string;
  roleDescription: string;
}

export interface RecommendedTeam {
  id: string;
  name: string;
  archetype: TeamArchetype;
  archetypeLabel: string;
  tier: 'S_TIER' | 'A_TIER';
  tierLabel: string;
  synergyScore: number;
  members: [RecommendedTeamMember, RecommendedTeamMember, RecommendedTeamMember];
  elementalSummary: string[];
  rationale: string;
  rotationGuide: string;
}

// 1. Explicit Role Classification
export const MAIN_DPS_SET = new Set<string>([
  'Jinhsi',
  'Camellya',
  'Changli',
  'Encore',
  'Jiyan',
  'Xiangli Yao',
  'Calcharo',
  'Rover: Havoc',
  'Rover: Spectro',
  'Rover: Aero',
  'Rover: Electro',
  'Lingyang',
  'Chixia',
  'Carlotta',
  'Phoebe',
  'Brant',
  'Augusta',
  'Aemeath',
  'Phrolova',
  'Danjin',
]);

export const SUB_DPS_BUFFER_SET = new Set<string>([
  'Yinlin',
  'Zhezhi',
  'Sanhua',
  'Mortefi',
  'Yangyang',
  'Yangyang: Xuanling',
  'Changli', // Dual-carry buffer
  'Danjin', // Havoc buffer
  'Taoqi',
  'Jianxin',
  'Aalto',
  'Yuanwu',
  'Lumi',
  'Cantarella',
  'Ciaccona',
  'Mornye',
  'Qingxiao',
]);

export const SUSTAINER_SET = new Set<string>([
  'Verina',
  'Shorekeeper',
  'Baizhi',
  'Youhu',
  'Jianxin',
  'Lucilla',
]);

// 2. Specific High-Synergy Outro Matching Matrix
interface OutroSynergyRule {
  buffer: string;
  mainDps: string;
  bonus: number;
  explanation: string;
}

const OUTRO_SYNERGY_RULES: OutroSynergyRule[] = [
  // Sanhua (+38% Basic Attack DMG)
  { buffer: 'Sanhua', mainDps: 'Camellya', bonus: 35, explanation: 'Sanhua kích hoạt Outro cực nhanh buff 38% sát thương Đòn Đánh Thường cho Camellya dồn sát thương hoa đỏ.' },
  { buffer: 'Sanhua', mainDps: 'Encore', bonus: 30, explanation: 'Sanhua Outro buff 38% Basic ATK tối ưu hóa đòn đánh thường của Encore trong trạng thái nộ Cosmos.' },
  { buffer: 'Sanhua', mainDps: 'Lingyang', bonus: 28, explanation: 'Sanhua buff 38% Basic ATK cho trạng thái múa lân của Lingyang.' },
  { buffer: 'Sanhua', mainDps: 'Rover: Havoc', bonus: 25, explanation: 'Sanhua hỗ trợ nạp Concerto nhanh và buff đòn đánh thường cho Rover Havoc.' },

  // Yinlin (+20% Electro, +25% Liberation DMG + Coordinated Attacks)
  { buffer: 'Yinlin', mainDps: 'Xiangli Yao', bonus: 35, explanation: 'Yinlin Outro buff 20% Lôi và 25% Chiêu Nộ hoàn hảo cho Xiangli Yao, kèm đòn phối hợp nạp sát thương.' },
  { buffer: 'Yinlin', mainDps: 'Calcharo', bonus: 32, explanation: 'Yinlin khuếch đại 20% sát thương Lôi và 25% Nộ cho Calcharo trong trạng thái Death Messenger.' },
  { buffer: 'Yinlin', mainDps: 'Jinhsi', bonus: 35, explanation: 'Đòn đánh phối hợp của Yinlin nạp tầng Incandescence thần tốc cho Jinhsi tung Chưởng Long.' },

  // Zhezhi (+20% Glacio, +25% Skill DMG + Coordinated Attacks)
  { buffer: 'Zhezhi', mainDps: 'Jinhsi', bonus: 35, explanation: 'Zhezhi Outro buff 25% Kỹ Năng và đòn đánh phối hợp giúp Jinhsi tích tối đa 50 tầng Incandescence.' },
  { buffer: 'Zhezhi', mainDps: 'Lingyang', bonus: 30, explanation: 'Zhezhi buff 20% Băng và 25% Kỹ Năng cho Lingyang.' },
  { buffer: 'Zhezhi', mainDps: 'Carlotta', bonus: 30, explanation: 'Zhezhi buff sát thương Băng và Kỹ Năng cho Carlotta.' },

  // Mortefi (+38% Heavy Attack DMG)
  { buffer: 'Mortefi', mainDps: 'Jiyan', bonus: 35, explanation: 'Mortefi Outro buff 38% Trọng Kích và rồng lửa phối hợp đồng bộ tuyệt đối với Thanh Long của Jiyan.' },
  { buffer: 'Mortefi', mainDps: 'Danjin', bonus: 22, explanation: 'Mortefi buff 38% Trọng Kích cho đòn chém máu của Danjin.' },

  // Changli (+20% Fusion, +25% Liberation DMG)
  { buffer: 'Changli', mainDps: 'Encore', bonus: 32, explanation: 'Changli buff 20% Hỏa và 25% Chiêu Nộ cho Encore, tạo thành bộ đôi Song Sát Hỏa Diệm Quickswap mạnh nhất.' },
  { buffer: 'Changli', mainDps: 'Chixia', bonus: 28, explanation: 'Changli buff Hỏa và Nộ cho Chixia xả đạn bộc phá liên hoàn.' },

  // Danjin (+23% Havoc DMG)
  { buffer: 'Danjin', mainDps: 'Rover: Havoc', bonus: 32, explanation: 'Danjin Outro buff 23% sát thương Hư Ảo cho Rover Havoc tạo ra những pha nộ triệu hồi vạc tối hủy diệt.' },
  { buffer: 'Danjin', mainDps: 'Camellya', bonus: 28, explanation: 'Danjin buff 23% sát thương Hư Ảo trực tiếp cho chuỗi combo của Camellya.' },

  // Yangyang (+20 Flat Energy)
  { buffer: 'Yangyang', mainDps: 'Jiyan', bonus: 24, explanation: 'Yangyang hồi ngay 20 Năng Lượng Nộ giúp Jiyan liên tục hóa rồng càn quét.' },
  { buffer: 'Yangyang', mainDps: 'Xiangli Yao', bonus: 24, explanation: 'Yangyang sạc nộ tức thì cho Xiangli Yao kích hoạt trạng thái đấm quyền.' },

  // Yuanwu (Coordinated attacks for Jinhsi)
  { buffer: 'Yuanwu', mainDps: 'Jinhsi', bonus: 28, explanation: 'Trụ sấm sét của Yuanwu kích hoạt đòn phối hợp liên tục sạc đầy thanh Incandescence cho Jinhsi.' },

  // Taoqi (+38% Skill DMG)
  { buffer: 'Taoqi', mainDps: 'Jinhsi', bonus: 25, explanation: 'Taoqi buff 38% sát thương Kỹ Năng cho Chưởng Long của Jinhsi kèm khiên bảo hộ.' },

  // Jianxin (+38% Liberation DMG)
  { buffer: 'Jianxin', mainDps: 'Calcharo', bonus: 24, explanation: 'Jianxin gom quái và buff 38% sát thương Nộ cho Calcharo quẩy kiếm.' },

  // Aalto (+23% Aero DMG)
  { buffer: 'Aalto', mainDps: 'Jiyan', bonus: 24, explanation: 'Aalto Outro buff 23% sát thương Khí Lưu cho Jiyan.' },
];

function getMemberDetails(resonatorId: string, role: CharacterRole): RecommendedTeamMember {
  const meta = CANONICAL_RESONATOR_METADATA[resonatorId];
  const weapon = CANONICAL_SIGNATURE_WEAPONS[resonatorId] || 'Vũ khí 5★ đề xuất';
  const element = meta?.element || 'Glacio';
  const rarity = meta?.rarity || 5;
  const sonata = getRecommendedSonataName(resonatorId, element);

  let roleLabel = 'Sát Thương Chính (Main DPS)';
  let roleColor = 'text-rose-400 bg-rose-500/10 border-rose-500/30';
  let roleDescription = 'Đứng sân gây sát thương chủ lực cho toàn đội';

  if (role === 'SUB_DPS') {
    roleLabel = 'Hỗ Trợ / Sát Thương Phụ (Sub-DPS)';
    roleColor = 'text-sky-400 bg-sky-500/10 border-sky-500/30';
    roleDescription = 'Nạp Concerto, gây sát thương phối hợp và kích hoạt Outro buff';
  } else if (role === 'SUSTAINER') {
    roleLabel = 'Hồi Phục / Bảo Hộ (Sustainer)';
    roleColor = 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30';
    roleDescription = 'Cung cấp hồi máu, tạo khiên chắn và khuếch đại sát thương toàn đội';
  }

  return {
    resonatorId,
    name: resonatorId,
    role,
    roleLabel,
    roleColor,
    element,
    rarity,
    recommendedWeaponName: weapon,
    recommendedSonataName: sonata,
    roleDescription,
  };
}

interface RawCandidateTrio {
  mainDps: string;
  subDps: string;
  sustainer: string;
  score: number;
  archetype: TeamArchetype;
  archetypeLabel: string;
  name: string;
  rationale: string;
  rotationGuide: string;
}

/**
 * Generates all valid 3-character team combinations from an owned roster with factual scoring.
 */
function generateAllCandidateTrios(ownedResonatorIds: readonly string[]): RawCandidateTrio[] {
  if (!ownedResonatorIds || ownedResonatorIds.length < 3) {
    return [];
  }

  const ownedMainDps = ownedResonatorIds.filter((id) => MAIN_DPS_SET.has(id));
  const ownedSubDps = ownedResonatorIds.filter((id) => SUB_DPS_BUFFER_SET.has(id));
  const ownedSustainers = ownedResonatorIds.filter((id) => SUSTAINER_SET.has(id));

  // If no healer, fallback to sub-dps pool
  const effectiveSustainers = ownedSustainers.length > 0 ? ownedSustainers : ownedSubDps;

  const candidates: RawCandidateTrio[] = [];
  const seenTrios = new Set<string>();

  for (const main of ownedMainDps) {
    for (const sub of ownedSubDps) {
      if (sub === main) continue;

      for (const sust of effectiveSustainers) {
        if (sust === main || sust === sub) continue;

        const trioKey = [main, sub, sust].sort().join(':::');
        if (seenTrios.has(trioKey)) continue;
        seenTrios.add(trioKey);

        let score = 50;
        let rationaleParts: string[] = [];

        // Check Outro synergy between sub and main
        const synergyRule = OUTRO_SYNERGY_RULES.find(
          (r) => r.buffer === sub && r.mainDps === main
        );

        if (synergyRule) {
          score += synergyRule.bonus;
          rationaleParts.push(synergyRule.explanation);
        } else {
          score += 15;
          rationaleParts.push(`${sub} kích hoạt đòn phối hợp và Outro bổ trợ nhịp nhàng cho ${main}.`);
        }

        // Sustainer Quality bonus
        if (sust === 'Verina') {
          score += 20;
          rationaleParts.push('Verina cung cấp 15% All-DMG Amplify toàn đội duy trì 30s và hồi phục dồi dào.');
        } else if (sust === 'Shorekeeper') {
          score += 20;
          rationaleParts.push('Shorekeeper mở cảnh vực Stellar Realm buff 12.5% Tỉ Lệ Bạo Kích & 25% Sát Thương Bạo Kích.');
        } else if (sust === 'Baizhi') {
          score += 12;
          rationaleParts.push('Baizhi đảm bảo hồi máu ổn định và buff 15% sát thương cho nhân vật kế tiếp.');
        } else if (sust === 'Jianxin') {
          score += 12;
          rationaleParts.push('Jianxin tạo khiên chắn vững chắc, gom quái và buff 38% chiêu nộ.');
        } else {
          score += 8;
          rationaleParts.push(`${sust} bảo hộ sinh tồn và duy trì thế trận ổn định cho toàn đội.`);
        }

        // Check if dual-carry quickswap
        const isDualCarry = MAIN_DPS_SET.has(sub);
        let archetype: TeamArchetype = 'HYPERCARRY';
        let archetypeLabel = 'Hypercarry Chủ Lực';

        if (isDualCarry) {
          archetype = 'QUICKSWAP_DUAL_CARRY';
          archetypeLabel = 'Quickswap Song Sát';
          score += 5;
        }

        // Elemental matching
        const mainMeta = CANONICAL_RESONATOR_METADATA[main];
        const subMeta = CANONICAL_RESONATOR_METADATA[sub];
        if (mainMeta && subMeta && mainMeta.element === subMeta.element) {
          score += 5;
          rationaleParts.push(`Cùng hệ ${mainMeta.element} cộng hưởng tăng hiệu quả khuếch đại nguyên tố.`);
        }

        const teamName = `Đội Hình ${main} - ${sub}`;
        const rotationGuide = `Thứ tự ra đòn (Rotation): 1. ${sust} (Kỹ năng E/Q nạp Rejuvenating Glow) ➔ 2. ${sub} (Gây sát thương, tích đầy thanh Concerto rồi kích hoạt Outro Skill) ➔ 3. ${main} (Nhận trọn vẹn Outro buff, bật chiêu nộ và dồn sát thương cực đại).`;

        candidates.push({
          mainDps: main,
          subDps: sub,
          sustainer: sust,
          score: Math.min(100, score),
          archetype,
          archetypeLabel,
          name: teamName,
          rationale: rationaleParts.join(' '),
          rotationGuide,
        });
      }
    }
  }

  return candidates;
}

/**
 * Evaluates and generates diverse reference teams from user's owned roster.
 */
export function generateRecommendedTeamsFromRoster(
  ownedResonatorIds: readonly string[],
  maxTeamsToReturn: number = 8
): RecommendedTeam[] {
  const candidates = generateAllCandidateTrios(ownedResonatorIds);
  if (candidates.length === 0) return [];

  // Sort descending by score
  candidates.sort((a, b) => b.score - a.score);

  const selected: RecommendedTeam[] = [];
  const mainDpsAppearanceCount = new Map<string, number>();

  for (const c of candidates) {
    const currentUsage = mainDpsAppearanceCount.get(c.mainDps) ?? 0;
    // Allow max 2 teams per main DPS to maintain high diversity
    if (currentUsage >= 2 && selected.length >= 3) {
      continue;
    }

    mainDpsAppearanceCount.set(c.mainDps, currentUsage + 1);

    const mMain = getMemberDetails(c.mainDps, 'MAIN_DPS');
    const mSub = getMemberDetails(c.subDps, 'SUB_DPS');
    const mSust = getMemberDetails(c.sustainer, 'SUSTAINER');

    const tier = c.score >= 90 ? 'S_TIER' : 'A_TIER';
    const tierLabel = c.score >= 90 ? 'S-Tier (Top Meta)' : 'A-Tier (Tối Ưu)';
    const elementalSummary = Array.from(new Set([mMain.element, mSub.element, mSust.element]));

    selected.push({
      id: `rec-team-${c.mainDps}-${c.subDps}-${c.sustainer}`,
      name: c.name,
      archetype: c.archetype,
      archetypeLabel: c.archetypeLabel,
      tier,
      tierLabel,
      synergyScore: c.score,
      members: [mMain, mSub, mSust],
      elementalSummary,
      rationale: c.rationale,
      rotationGuide: c.rotationGuide,
    });

    if (selected.length >= maxTeamsToReturn) {
      break;
    }
  }

  return selected;
}

/**
 * Selects K mutually disjoint (non-overlapping) teams from the owned roster
 * maximizing total team synergy score. Perfect for Tower of Adversity 3-team setup.
 */
export function generateDisjointTeamPortfolioFromRoster(
  ownedResonatorIds: readonly string[],
  targetK: number = 3
): RecommendedTeam[] {
  const candidates = generateAllCandidateTrios(ownedResonatorIds);
  if (candidates.length === 0) return [];

  candidates.sort((a, b) => b.score - a.score);

  const bestSelection: RawCandidateTrio[] = [];
  let bestScore = -1;

  function search(startIndex: number, current: RawCandidateTrio[], used: Set<string>, curScore: number) {
    if (current.length === targetK) {
      if (curScore > bestScore) {
        bestScore = curScore;
        bestSelection.length = 0;
        bestSelection.push(...current);
      }
      return;
    }

    // Optimization: limit search depth to top 40 candidates for instant performance
    const maxScan = Math.min(candidates.length, 50);
    for (let i = startIndex; i < maxScan; i++) {
      const cand = candidates[i];
      if (used.has(cand.mainDps) || used.has(cand.subDps) || used.has(cand.sustainer)) {
        continue;
      }

      used.add(cand.mainDps);
      used.add(cand.subDps);
      used.add(cand.sustainer);
      current.push(cand);

      search(i + 1, current, used, curScore + cand.score);

      current.pop();
      used.delete(cand.mainDps);
      used.delete(cand.subDps);
      used.delete(cand.sustainer);

      if (bestSelection.length === targetK && bestScore >= targetK * 98) {
        break;
      }
    }
  }

  search(0, [], new Set(), 0);

  // If backtracking couldn't find full K, fallback to greedy
  let finalCandidates = bestSelection;
  if (finalCandidates.length < targetK) {
    const used = new Set<string>();
    finalCandidates = [];
    for (const c of candidates) {
      if (!used.has(c.mainDps) && !used.has(c.subDps) && !used.has(c.sustainer)) {
        finalCandidates.push(c);
        used.add(c.mainDps);
        used.add(c.subDps);
        used.add(c.sustainer);
        if (finalCandidates.length === targetK) break;
      }
    }
  }

  return finalCandidates.map((c, idx) => {
    const mMain = getMemberDetails(c.mainDps, 'MAIN_DPS');
    const mSub = getMemberDetails(c.subDps, 'SUB_DPS');
    const mSust = getMemberDetails(c.sustainer, 'SUSTAINER');
    const tier = c.score >= 90 ? 'S_TIER' : 'A_TIER';
    const tierLabel = c.score >= 90 ? 'S-Tier (Top Meta)' : 'A-Tier (Tối Ưu)';
    const elementalSummary = Array.from(new Set([mMain.element, mSub.element, mSust.element]));

    return {
      id: `disjoint-team-${idx + 1}-${c.mainDps}-${c.subDps}-${c.sustainer}`,
      name: `Đội Hình ${idx + 1}: ${c.mainDps} - ${c.subDps}`,
      archetype: c.archetype,
      archetypeLabel: c.archetypeLabel,
      tier,
      tierLabel,
      synergyScore: c.score,
      members: [mMain, mSub, mSust],
      elementalSummary,
      rationale: c.rationale,
      rotationGuide: c.rotationGuide,
    };
  });
}
