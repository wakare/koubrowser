import {
  ApiBattle,
  ApiHougeki,
  ApiHougekiMidnight,
  ApiMidnightBattleType,
  ApiMidnightSpBattle,
  KcsUtil,
  PrvBattleInfo
} from './kcs'

export interface EnemyState {
  id: number
  hp: number
}

export interface FriendlyFleetState {
  main: (number | undefined)[]
  escort: (number | undefined)[]
}

interface FriendlyHpAccumulator {
  main: (number | undefined)[]
  escort: (number | undefined)[]
}

interface FriendlyDamageStage {
  readonly api_fdam?: readonly number[] | null
}

interface FriendlyAerialDamage {
  readonly api_stage3?: FriendlyDamageStage | null
  readonly api_stage3_combined?: FriendlyDamageStage | null
}

type RaigekiListItem = number | readonly (number | null)[] | null

interface FriendlyRaigekiDamage {
  readonly api_erai?: readonly (number | null)[]
  readonly api_eydam?: readonly (number | null)[]
  readonly api_fdam?: readonly (number | null)[]
  readonly api_erai_list_items?: readonly RaigekiListItem[]
  readonly api_eydam_list_items?: readonly RaigekiListItem[]
}

interface FriendlyBattleDamage {
  readonly api_f_nowhps: readonly number[]
  readonly api_f_nowhps_combined?: readonly number[]
  readonly api_injection_kouku?: FriendlyAerialDamage | null
  readonly api_kouku?: FriendlyAerialDamage | null
  readonly api_kouku2?: FriendlyAerialDamage | null
  readonly api_opening_taisen?: ApiHougeki | null
  readonly api_opening_atack?: FriendlyRaigekiDamage | null
  readonly api_n_hougeki1?: ApiHougeki | ApiHougekiMidnight | null
  readonly api_n_hougeki2?: ApiHougeki | ApiHougekiMidnight | null
  readonly api_hougeki1?: ApiHougeki | null
  readonly api_hougeki2?: ApiHougeki | null
  readonly api_hougeki3?: ApiHougeki | null
  readonly api_raigeki?: FriendlyRaigekiDamage | null
  readonly api_hougeki?: ApiHougekiMidnight | null
}

const normalizeFriendlyHps = (hps: readonly number[] | undefined): (number | undefined)[] =>
  (hps ?? []).map((hp) => (Number.isFinite(hp) && hp >= 0 ? hp : undefined))

const applyFriendlyDamage = (
  state: FriendlyHpAccumulator,
  position: number | null | undefined,
  damage: number | null | undefined
): boolean => {
  if (
    position === null ||
    position === undefined ||
    position < 0 ||
    damage === null ||
    damage === undefined ||
    !Number.isFinite(damage)
  ) {
    return false
  }

  const target =
    state.escort.length > 0 && position >= 6
      ? { hps: state.escort, index: position - 6 }
      : { hps: state.main, index: position }
  const hp = target.hps[target.index]
  if (hp === undefined) {
    return false
  }

  target.hps[target.index] = hp - Math.floor(Math.max(0, damage))
  return true
}

const applyFriendlyDamageArray = (
  hps: (number | undefined)[],
  damages: readonly (number | null)[] | null | undefined
): void => {
  damages?.forEach((damage, index) => {
    const hp = hps[index]
    if (hp !== undefined && damage !== null && Number.isFinite(damage)) {
      hps[index] = hp - Math.floor(Math.max(0, damage))
    }
  })
}

const applyFriendlyAerialDamage = (
  state: FriendlyHpAccumulator,
  aerial: FriendlyAerialDamage | null | undefined
): void => {
  applyFriendlyDamageArray(state.main, aerial?.api_stage3?.api_fdam)
  applyFriendlyDamageArray(state.escort, aerial?.api_stage3_combined?.api_fdam)
}

const applyFriendlyHougekiDamage = (
  state: FriendlyHpAccumulator,
  hougeki: ApiHougeki | ApiHougekiMidnight | null | undefined
): void => {
  hougeki?.api_at_eflag.forEach((enemyFlag, attackIndex) => {
    if (enemyFlag !== 1) {
      return
    }

    const defenders = hougeki.api_df_list[attackIndex] ?? []
    const damages = hougeki.api_damage[attackIndex] ?? []
    defenders.forEach((defender, hitIndex) => {
      applyFriendlyDamage(state, defender, damages[hitIndex])
    })
  })
}

const toRaigekiList = (value: RaigekiListItem | undefined): readonly (number | null)[] => {
  if (Array.isArray(value)) {
    return value
  }
  return value === null || value === undefined ? [] : [value as number]
}

const applyFriendlyRaigekiDamage = (
  state: FriendlyHpAccumulator,
  raigeki: FriendlyRaigekiDamage | null | undefined
): void => {
  if (!raigeki) {
    return
  }

  if (raigeki.api_erai_list_items !== undefined && raigeki.api_eydam_list_items !== undefined) {
    raigeki.api_eydam_list_items.forEach((damageItem, attackerIndex) => {
      const targets = toRaigekiList(raigeki.api_erai_list_items?.[attackerIndex])
      const damages = toRaigekiList(damageItem)
      damages.forEach((damage, hitIndex) => {
        applyFriendlyDamage(state, targets[hitIndex], damage)
      })
    })
    return
  }

  if (raigeki.api_erai !== undefined && raigeki.api_eydam !== undefined) {
    raigeki.api_eydam.forEach((damage, attackerIndex) => {
      applyFriendlyDamage(state, raigeki.api_erai?.[attackerIndex], damage)
    })
    return
  }

  // Older responses may only expose the aggregate friendly damage array.
  raigeki.api_fdam?.forEach((damage, position) => {
    applyFriendlyDamage(state, position, damage)
  })
}

const applyFriendlyMiddayDamage = (
  state: FriendlyHpAccumulator,
  battle: FriendlyBattleDamage
): void => {
  const aerialPhases = [battle.api_injection_kouku, battle.api_kouku, battle.api_kouku2]
  aerialPhases.forEach((aerial) => applyFriendlyAerialDamage(state, aerial))

  applyFriendlyHougekiDamage(state, battle.api_n_hougeki1)
  applyFriendlyHougekiDamage(state, battle.api_n_hougeki2)
  applyFriendlyHougekiDamage(state, battle.api_opening_taisen)
  applyFriendlyRaigekiDamage(state, battle.api_opening_atack)
  applyFriendlyHougekiDamage(state, battle.api_hougeki1)
  applyFriendlyHougekiDamage(state, battle.api_hougeki2)
  applyFriendlyHougekiDamage(state, battle.api_hougeki3)
  applyFriendlyRaigekiDamage(state, battle.api_raigeki)
}

const applyFriendlyMidnightDamage = (
  state: FriendlyHpAccumulator,
  battle: FriendlyBattleDamage
): void => {
  applyFriendlyHougekiDamage(state, battle.api_hougeki)
}

/**
 * Calculates the friendly fleet HP visible at battle result time from observed battle data.
 *
 * Damage-control activation is intentionally not predicted here. The game does not include
 * consumed equipment in the battle-result response, so that state remains authoritative only
 * after the next ship/deck update.
 */
export const calcFriendlyHps = (battleInfo: PrvBattleInfo): FriendlyFleetState => {
  const initialBattle = (battleInfo.midday ?? battleInfo.midnight) as FriendlyBattleDamage | null
  if (!initialBattle) {
    return { main: [], escort: [] }
  }

  const state: FriendlyHpAccumulator = {
    main: normalizeFriendlyHps(initialBattle.api_f_nowhps),
    escort: normalizeFriendlyHps(initialBattle.api_f_nowhps_combined)
  }

  if (battleInfo.midday) {
    applyFriendlyMiddayDamage(state, battleInfo.midday as unknown as FriendlyBattleDamage)
  }
  if (battleInfo.midnight) {
    applyFriendlyMidnightDamage(state, battleInfo.midnight as unknown as FriendlyBattleDamage)
  }

  return {
    main: state.main.map((hp) => (hp === undefined ? undefined : Math.max(0, hp))),
    escort: state.escort.map((hp) => (hp === undefined ? undefined : Math.max(0, hp)))
  }
}

export function damaged(
  hps: number[],
  damages: number[] | null | undefined,
  offset: number = 0
): void {
  const hpLen = hps.length
  damages?.forEach((damage, index) => {
    console.log('index:', index, 'damage:', damage, 'nowhp:', hps[index])
    if (index < hpLen) {
      hps[offset + index] -= Math.floor(damage)
    }
  })
}

export function hougekiDam(
  hps: number[],
  hougeki: ApiHougeki | ApiHougekiMidnight | undefined | null
): void {
  if (!hougeki) {
    return
  }

  console.log(
    '>> hougeki damage info. hps:',
    hps,
    'api_damage:',
    hougeki.api_damage,
    'api_fd_list:',
    hougeki.api_df_list
  )
  hougeki.api_at_eflag.forEach((eflag, index) => {
    if (0 === eflag) {
      const df_list = hougeki.api_df_list[index]
      console.log('hougeki index:', index, 'eflags:', eflag, 'df_list:', df_list)
      const dmg = hougeki.api_damage[index]
      df_list?.forEach((df, df_index) => {
        console.log(
          'gamage from, to:',
          index,
          df,
          'to hp:',
          hps[df] ?? null,
          'damage:',
          dmg?.[df_index] ?? null
        )
        if (df < hps.length) {
          hps[df] -= Math.floor(dmg?.[df_index] ?? 0)
        }
      })
    }
  })
  console.log('<< hougeki damage info. hps:', hps)
}

export function calcMiddayDamage(hps: number[], api_battle: ApiBattle): void {
  const air_base_attack = api_battle.api_air_base_attack
  const stage3_edam = api_battle.api_kouku?.api_stage3?.api_edam
  const stage3_edam_combined = api_battle.api_kouku?.api_stage3_combined?.api_edam
  const opening_atack_edam = api_battle.api_opening_atack?.api_edam
  const opening_taisen_edam = api_battle.api_opening_taisen
  const support_air_dam = api_battle.api_support_info?.api_support_airatack?.api_stage3.api_edam
  const support_hourai_dam = api_battle.api_support_info?.api_support_hourai?.api_damage
  const hougeki1 = api_battle.api_hougeki1
  const hougeki2 = api_battle.api_hougeki2
  const hougeki3 = api_battle.api_hougeki3
  const raigeki_dam = api_battle.api_raigeki?.api_edam

  //
  air_base_attack?.forEach((attack) => {
    {
      const edam = attack.api_stage3?.api_edam
      //console.log('>> air base attack:', index, ' dam:', edam, 'hps:', hps);
      damaged(hps, edam)
      //console.log('<< air base attack:', index, ' dam:', edam, 'hps:', hps);
    }

    {
      const edam = attack.api_stage3_combined?.api_edam
      //console.log('>> air base attack combined:', index, ' dam:', edam, 'hps:', hps);
      damaged(hps, edam, 6)
      //console.log('<< air base attack combined:', index, ' dam:', edam, 'hps:', hps);
    }
  })

  //
  //console.log('>> stage3 dam:', stage3_edam, 'hps:', hps);
  damaged(hps, stage3_edam)
  //console.log('<< stage3 dam hps:', hps);

  //
  //console.log('>> stage3 dam combined:', stage3_edam_combined, 'hps:', hps);
  damaged(hps, stage3_edam_combined, 6)
  //console.log('<< stage3 dam combined hps:', hps);

  //
  //console.log('>> support air dam:', support_air_dam, 'hps:', hps);
  damaged(hps, support_air_dam)
  //console.log('<< support air hps:', hps);

  //
  //console.log('>> support hourai dam:', support_hourai_dam, 'hps:', hps);
  damaged(hps, support_hourai_dam)
  //console.log('<< support hourai dam hps:', hps);

  //
  //console.log('>> opening dam:', opening_atack_edam, 'hps:', hps);
  damaged(hps, opening_atack_edam)
  //console.log('<< opening dam hps:', hps);

  //
  //console.log('>> raigeki dam:', raigeki_dam, 'hps:', hps);
  damaged(hps, raigeki_dam)
  //console.log('<< raigeki dam hps:', hps);

  //
  //console.log('>> opening taisen dam:', opening_taisen_edam, 'hps:', hps);
  hougekiDam(hps, opening_taisen_edam)
  //console.log('<< opening taisen dam:', opening_taisen_edam, 'hps:', hps);

  //
  //console.log('>> hougeki1 dam:', hougeki1, 'hps:', hps);
  hougekiDam(hps, hougeki1)
  //console.log('<< hougeki1 dam:', hougeki1, 'hps:', hps);

  //
  //console.log('>> hougeki2 dam:', hougeki2, 'hps:', hps);
  hougekiDam(hps, hougeki2)
  //console.log('<< hougeki2 dam:', hougeki2, 'hps:', hps);

  //
  //console.log('>> hougeki3 dam:', hougeki3, 'hps:', hps);
  hougekiDam(hps, hougeki3)
  //console.log('<<  hougeki3 dam:', hougeki3, 'hps:', hps);
}

export const calcMidnightDamage = (hps: number[], midnight: ApiMidnightBattleType): void => {
  //
  if (KcsUtil.isMidnightSpBattle(midnight)) {
    const sp = midnight as ApiMidnightSpBattle
    const support_air_dam = sp.api_n_support_info?.api_support_airatack?.api_stage3.api_edam
    const support_hourai_dam = sp.api_n_support_info?.api_support_hourai?.api_damage
    damaged(hps, support_air_dam)
    damaged(hps, support_hourai_dam)
  }

  // friendly
  if (midnight.api_friendly_battle) {
    const hougeki = midnight.api_friendly_battle.api_hougeki
    console.log('>> midnight hougeki friendly dam:', hougeki, 'hps:', hps)
    hougekiDam(hps, hougeki)
    console.log('<< midnight hougeki friendly dam:', hougeki, 'hps:', hps)
  }

  //
  console.log('>> midnight hougeki dam:', midnight.api_hougeki, 'hps:', hps)
  hougekiDam(hps, midnight.api_hougeki)
  console.log('<< midnight hougeki dam:', midnight.api_hougeki, 'hps:', hps)
}

/*
const enemyParam = (arg: PrvBattleInfo): EnemyParam[] => {
  const ship_ke = arg.midday ? arg.midday.api_ship_ke : (arg.midnight?.api_ship_ke ?? [])
  const eSlot = arg.midday ? arg.midday.api_eSlot : (arg.midnight?.api_eSlot ?? [])
  const eParam = arg.midday ? arg.midday.api_eParam : (arg.midnight?.api_eParam ?? [])
  const e_maxhps = arg.midday ? arg.midday.api_e_maxhps : (arg.midnight?.api_e_maxhps ?? [])
  const e_nowhps = arg.midday ? arg.midday.api_e_nowhps : (arg.midnight?.api_e_nowhps ?? [])
  const nowhps = e_nowhps.concat()

  if (KcsUtil.isBattle(arg.midday)) {
    calcMiddayDamage(nowhps, arg.midday as ApiBattle)
  }

  if (arg.midnight) {
    calcMidnightDamage(nowhps, arg.midnight)
  }

  return ship_ke.map((_, index) => {
    const prm = eParam[index]
    const param: EParam = [
      prm[0] ?? null,
      prm[1] ?? null,
      prm[2] ?? null,
      prm[3] ?? null,
      e_maxhps[index] ?? null,
      nowhps[index] ?? null
    ]
    //console.log('enemy param slot:', eSlot[index], 'param:', param);
    return {
      slot: eSlot[index] ?? [],
      param
    }
  })
}
*/

export const calcEnemyHps = (arg: PrvBattleInfo): EnemyState[] => {
  const e_ship_ke = arg.midday ? arg.midday.api_ship_ke : (arg.midnight?.api_ship_ke ?? [])
  const e_nowhps = arg.midday ? arg.midday.api_e_nowhps : (arg.midnight?.api_e_nowhps ?? [])
  const ship_ke = e_ship_ke.concat()
  const nowhps = e_nowhps.concat()

  console.log('ship_ke', ship_ke, nowhps)

  const pushCombined = (battle: any): void => {
    if (Array.isArray(battle.api_ship_ke_combined) && Array.isArray(battle.api_e_nowhps_combined)) {
      ship_ke.push(...(battle.api_ship_ke_combined as number[]))
      nowhps.push(...(battle.api_e_nowhps_combined as number[]))
    }
  }

  if (arg.midday) {
    pushCombined(arg.midday as any)
    console.log('ship_ke2', ship_ke, nowhps)
  } else if (arg.midnight) {
    pushCombined(arg.midnight as any)
    console.log('ship_ke3', ship_ke, nowhps)
  }

  if (KcsUtil.isBattle(arg.midday)) {
    calcMiddayDamage(nowhps, arg.midday as ApiBattle)
    console.log('ship_ke4', ship_ke, nowhps)
  }

  if (arg.midnight) {
    calcMidnightDamage(nowhps, arg.midnight)
    console.log('ship_ke5', ship_ke, nowhps)
  }

  const ret = ship_ke.map((el, index) => ({ id: el, hp: nowhps[index] ?? 9999 }))
  console.log('calc enemy hps', ret)
  return ret
}

/*
const enemyParamCombined = (arg: PrvBattleInfo): EnemyParam[] => {

  const fParam = arg.midday ? arg.midday.api_fParam : arg.midnight?.api_fParam ?? [];
  const e_maxhps = arg.midday ? arg.midday.api_f_maxhps : arg.midnight?.api_f_maxhps ?? [];
  let e_nowhps = arg.midday ? arg.midday.api_e_nowhps : arg.midnight?.api_e_nowhps ?? [];
  const stage3_dam = arg.midday?.api_kouku?.api_stage3?.api_edam;
  const api_battle = KcsUtil.isBattle(arg.midday) ? (arg.midday as ApiBattle) : undefined;
  const opening_atack_dam = api_battle?.api_opening_atack?.api_edam;
  const hougeki1 = api_battle?.api_hougeki1;
  const hougeki2 = api_battle?.api_hougeki2;
  const hougeki3 = api_battle?.api_hougeki3;
  const raigeki_dam = api_battle?.api_raigeki?.api_edam;
  const midnight_hougeki = arg.midnight?.api_hougeki;

  e_nowhps = e_nowhps.map((hp, index) => {
    hp -= stage3_dam?.[index] ?? 0;
    hp -= opening_atack_dam?.[index] ?? 0;
    hp -= raigeki_dam?.[index] ?? 0;
    return hp;
  });
  e_nowhps = hougekiDam(e_nowhps, hougeki1);
  e_nowhps = hougekiDam(e_nowhps, hougeki2);
  e_nowhps = hougekiDam(e_nowhps, hougeki3);
  e_nowhps = hougekiDam(e_nowhps, midnight_hougeki);
  return fParam.map((param, index) => {
    const maxhp = e_maxhps[index] ?? -1;
    const nowhp = e_nowhps[index] ?? -1;
    param.push(maxhp);
    param.push(nowhp);
    return [param[0] ?? -1, param[1] ?? -1, param[2] ?? -1, param[3] ?? -1, maxhp, nowhp];
  });
};
*/
