const fs = require('fs')
const mathjs = require('mathjs')

const NUM_TRAILS = 100000
const ENEMY_HP = 60
const ENEMY_ARMOR = 15

function rollToHit() {
  const firstroll = Math.floor(Math.random()*10)+1
  if (firstroll == 1 || firstroll == 10) {
    const secondroll = Math.floor(Math.random()*10)+1
    if (firstroll == 1) {
      return firstroll-secondroll
    }
    return firstroll+secondroll
  }
  return firstroll
}

function rollDamage(dice, diceSize=6) {
  let sum = 0;
  let sixCount = 0;
  for (let i = 0; i < dice; i++) {
    const die = Math.floor(Math.random()*diceSize)+1
    if (die == 6)
      sixCount += 1
    sum += die
  }
  return {
    roll: sum,
    crit: sixCount > 1
  }
}

function armorPiercingTest(dice) {
  const basicResults = basicHitsToKill(dice)
  const apResults = []
  for(let i = 0; i < NUM_TRAILS; i++) {
    let armor = ENEMY_ARMOR
    let hp = ENEMY_HP
    let rollCount = 0
    while (hp > 0) {
      const {roll,crit} = rollDamage(dice)
      rollCount += 1
      if (roll > armor) {
        hp -= roll - armor
        armor -= 2
        if (armor < 0) { armor = 0 }
        if (crit) { hp -= 5 }
      }
    }
    apResults.push(rollCount)
  }
  const basicStats = statify(basicResults, 'Average Hits to Kill', 'Standard Deviation')
  const apStats = statify(apResults, 'Average Hits to Kill', 'Standard Deviation')
  return {
    trial: {
      hp: ENEMY_HP,
      armor: ENEMY_ARMOR,
      dice: dice,
    },
    basic: basicStats,
    ap: apStats,
  }
}

function statify(data, averageLabel, stddevLabel, stddev = true, singleLine = false) {
  const average = mathjs.sum(data) / NUM_TRAILS
  const stdDev = mathjs.std(data,'uncorrected')
  const withoutOutliers = data.filter((n)=>{
    if( n > average + 2 * stdDev ) 
      return false;
    if( n < average - 2 * stdDev )
      return false;
    return true;
  })
  const adjustedAverage = mathjs.sum(withoutOutliers) / withoutOutliers.length
  const results = {}
  results[averageLabel] = adjustedAverage
  results[stddevLabel] = stdDev
  if (stddev) {
    return results
  }
  if(singleLine) {
    return `${Math.round(adjustedAverage*100)/100} (${Math.round(stdDev*100)/100})`
  }
  return Math.round(adjustedAverage*100)/100
}

function basicHitsToKill(dice) {
  const basicResults = []
  for(let i = 0; i < NUM_TRAILS; i++) {
    let armor = ENEMY_ARMOR
    let hp = ENEMY_HP
    let rollCount = 0
    while (hp > 0) {
      const {roll,crit} = rollDamage(dice)
      rollCount += 1
      if (roll > armor) {
        hp -= roll - armor
        armor -= 1
        if (armor < 0) { armor = 0 }
        if (crit) { hp -= 5 }
      }
    }
    basicResults.push(rollCount)
  }
  return basicResults
}

function autofireTurnsToKill(modifier,dv, maxAmmo, {maxAutoMod = 4, guaranteedMultiplier = 0, turnsToReload = 1, rollAllDice = false, dieSize = 6, diceAmount = 2}={}) {
  const results = []
  for(let i = 0; i < NUM_TRAILS; i++) { 
    let armor = ENEMY_ARMOR
    let hp = ENEMY_HP
    let ammo = maxAmmo
    let rollCount = 0
    while( hp > 0 ) {
      rollCount += 1
      if(ammo < 10) { 
        ammo = maxAmmo;
        if(turnsToReload > 1) {
          rollCount += turnsToReload - 1
        } 
        continue 
      } 
      else { ammo -= 10 }
      const hitRoll = rollToHit()
      if ( hitRoll + modifier > dv ) {
        const multi = Math.min(hitRoll + modifier - dv + guaranteedMultiplier,maxAutoMod)
        let damageRoll
        let crit
        if (rollAllDice == true) {
          let {roll: d,c} = rollDamage(diceAmount*multi,dieSize)
          damageRoll = d
          crit = c
        } else {
          let {roll: d,c} = rollDamage(diceAmount,dieSize)
          d *= multi
          damageRoll = d
          crit = c
        }
        if (damageRoll > armor) {
          hp -= damageRoll - armor
          armor -= 1
          if (armor < 0) { armor = 0 }
          if (crit) { hp -= 5 }
        }
      }
    }
    results.push(rollCount)
  }
  return results
}

function basicTurnsToKill(dice, modifier, dv, maxAmmo, rof) {
  const rateOfFire = rof ?? 1
  // turn to kill
  const results = []
  for(let i = 0; i < NUM_TRAILS; i++) { 
    let armor = ENEMY_ARMOR
    let hp = ENEMY_HP
    let ammo = maxAmmo
    let rollCount = 0
    while( hp > 0 ) {
      rollCount += 1
      if(ammo < rateOfFire) { ammo = maxAmmo; continue; } 
      for (let s = 0; s < rateOfFire; s++)
      {
        ammo -= 1
        const hitRoll = rollToHit()
        if ( hitRoll + modifier > dv ) {
          const {roll: damageRoll,crit} = rollDamage(dice)
          if (damageRoll > armor) {
            hp -= damageRoll - armor
            armor -= 1
            if (armor < 0) { armor = 0 }
            if (crit) { hp -= 5 }
          }
        }
      }
    }
    results.push(rollCount)
  }
  return results
}

function zeusTurnsToKill(dice, modifier, dv, {enemyHP = ENEMY_HP, enemyArmor = ENEMY_ARMOR, 
  capacitorCharges = 3, magSize = 1, armorIgnored = 8, armorDestoryed = 4} = {}) {
  const rateOfFire = 1
  // turn to kill
  const results = []
  for(let i = 0; i < NUM_TRAILS; i++) { 
    let armor = enemyArmor
    let hp = enemyHP
    let ammo = magSize
    let cap = capacitorCharges
    let rollCount = 0
    while( hp > 0 ) {
      rollCount += 1
      if(ammo < rateOfFire) { ammo = magSize; continue; } 
      if(capacitorCharges < rateOfFire) { cap = capacitorCharges; continue; } 
      for (let s = 0; s < rateOfFire; s++)
      {
        ammo -= 1
        const hitRoll = rollToHit()
        if ( hitRoll + modifier > dv ) {
          const {roll: damageRoll,crit} = rollDamage(dice)
          if (damageRoll > armor - armorIgnored) {
            hp -= damageRoll - (armor - armorIgnored)
            armor -= armorDestoryed
            if (armor < 0) { armor = 0 }
            if (crit) { hp -= 5 }
          }
        }
      }
    }
    results.push(rollCount)
  }
  return results
}

function incendaryTestLeaveIt(dice, modifier, dv){
  // turn to kill
  const basicResults = basicTurnsToKill(dice,modifier,dv)
  const incendaryResults = []
  for(let i = 0; i < NUM_TRAILS; i++) { 
    let armor = ENEMY_ARMOR
    let hp = ENEMY_HP
    let rollCount = 0
    let onFire = false
    while( hp > 0 ) {
      const hitRoll = rollToHit()
      rollCount += 1
      if ( hitRoll + modifier > dv ) {
        const {roll:damageRoll,crit} = rollDamage(dice)
        if (damageRoll > armor) {
          hp -= damageRoll - armor
          armor -= 1
          onFire = true
          if (armor < 0) { armor = 0 }
          if (crit) { hp -= 5 }
        }
      }
      if (onFire) { hp -= 2 }
    }
    incendaryResults.push(rollCount)
  }
  const basicStats = statify(basicResults, 'Turns to Kill', 'Standard Deviation')
  const incendaryStats = statify(incendaryResults, 'Turns to Kill', 'Standard Deviation')
  return {
    trial: {
      hp: ENEMY_HP,
      armor: ENEMY_ARMOR,
      dice,
      modifier,
      dv
    },
    basic: basicStats,
    incendary: incendaryStats,
  }
}

function incendaryTestPutItOut(dice, modifier, dv) {
  // % of shots that 'stun'
  // const basicResults = basicTurnsToKill(dice,modifier,dv)
  const incendaryResults = []
  for(let i = 0; i < NUM_TRAILS; i++) { 
    let armor = ENEMY_ARMOR
    let hp = ENEMY_HP
    let rollCount = 0
    let stunCount = 0
    let onFire = false
    while( hp > 0 ) {
      if( onFire ) {
        onFire = false
        stunCount += 1
      }
      const hitRoll = rollToHit()
      rollCount += 1
      if ( hitRoll + modifier > dv ) {
        const {roll:damageRoll,crit} = rollDamage(dice)
        if (damageRoll > armor) {
          hp -= damageRoll - armor
          armor -= 1
          onFire = true
          if (armor < 0) { armor = 0 }
          if (crit) { hp -= 5 }
        }
      }
    }
    incendaryResults.push(stunCount/rollCount)
  }
  // const basicStats = statify(basicResults, 'Turns Hits to Kill', 'Standard Deviation')
  const incendaryStats = statify(incendaryResults, 'Percent of Turns Stunned before Killed', 'Standard Deviation')
  return {
    trial: {
      hp: ENEMY_HP,
      armor: ENEMY_ARMOR,
      dice,
      modifier,
      dv
    },
    // basic: basicStats,
    incendary: incendaryStats,
  }
}

function smartTest(dice, modifier, dv) {
  // chance to hit vs basic ammo
  const basicResults = basicTurnsToKill(dice,modifier,dv)
  const smartResults = []
  for(let i = 0; i < NUM_TRAILS; i++) { 
    let armor = ENEMY_ARMOR
    let hp = ENEMY_HP
    let rollCount = 0
    while( hp > 0 ) {
      const hitRoll = rollToHit()
      rollCount += 1
      if ( hitRoll + modifier > dv ) {
        const {roll:damageRoll,crit} = rollDamage(dice)
        if (damageRoll > armor) {
          hp -= damageRoll - armor
          armor -= 1
          if (armor < 0) { armor = 0 }
          if (crit) { hp -= 5 }
        }
      } else if ( dv - ( hitRoll + modifier ) < 4) {
        const hitReRoll = rollToHit()
        if (hitReRoll + 10 > dv) {
          const {roll:damageRoll,crit} = rollDamage(dice)
          if (damageRoll > armor) {
            hp -= damageRoll - armor
            armor -= 1
            if (armor < 0) { armor = 0 }
            if (crit) { hp -= 5 }
          }
        }
      }
    }
    smartResults.push(rollCount)
  }
  const basicStats = statify(basicResults, 'Turns to Kill', 'Standard Deviation')
  const smartStats = statify(smartResults, 'Turns to Kill', 'Standard Deviation')
  return {
    trial: {
      hp: ENEMY_HP,
      armor: ENEMY_ARMOR,
      dice,
      modifier,
      dv
    },
    basic: basicStats,
    smart: smartStats,
  }
}

function armorTest(dice, modifier, dv) {
  const lightResults = basicTurnsToKill(dice,modifier,dv)
  const debuffResults = basicTurnsToKill(dice,modifier-2,dv)
  const mediumResults = []
  const heavyResults = []
  for(let i = 0; i < NUM_TRAILS; i++) { 
    let armor = ENEMY_ARMOR + 1
    let hp = ENEMY_HP
    let rollCount = 0
    while( hp > 0 ) {
      const hitRoll = rollToHit()
      if ( hitRoll + modifier > dv ) {
        const {roll: damageRoll,crit} = rollDamage(dice)
        if (damageRoll > armor) {
          hp -= damageRoll - armor
          armor -= 1
          if (armor < 0) { armor = 0 }
          if (crit) { hp -= 5 }
        }
      }
      rollCount += 1
    }
    mediumResults.push(rollCount)
  }
  for(let i = 0; i < NUM_TRAILS; i++) { 
    let armor = ENEMY_ARMOR + 2
    let hp = ENEMY_HP
    let rollCount = 0
    while( hp > 0 ) {
      const hitRoll = rollToHit()
      if ( hitRoll + modifier > dv ) {
        const {roll: damageRoll,crit} = rollDamage(dice)
        if (damageRoll > armor) {
          hp -= damageRoll - armor
          armor -= 1
          if (armor < 0) { armor = 0 }
          if (crit) { hp -= 5 }
        }
      }
      rollCount += 1
    }
    heavyResults.push(rollCount)
  }
  const basicStats = statify(lightResults, 'Turns to Kill', 'Standard Deviation')
  const mediumStats = statify(mediumResults, 'Turns to Kill', 'Standard Deviation')
  const heavyStats = statify(heavyResults, 'Turns to Kill', 'Standard Deviation')
  const debuffStats = statify(debuffResults, 'Turns to Kill', 'Standard Deviation')
  return {
    trial: {
      hp: ENEMY_HP,
      dice,
      modifier,
      dv
    },
    '11 SP': basicStats,
    '12 SP': mediumStats,
    '13 SP': heavyStats,
    '11 SP with debuff': debuffStats,
    analysis: {
      'medium': mediumStats['Turns to Kill']/basicStats['Turns to Kill'],
      'heavy': heavyStats['Turns to Kill']/basicStats['Turns to Kill'],
      'debuff': debuffStats['Turns to Kill']/basicStats['Turns to Kill'],
    }
  }
}

function headshotsTest(dice, modifier, dv) {
  const controlResults = basicTurnsToKill(dice,modifier,dv)
  const aimedMod = modifier - 7;
  const basicResults = []
  const smartResults = []
  for(let i = 0; i < NUM_TRAILS; i++) { 
    let armor = ENEMY_ARMOR - 11
    let hp = ENEMY_HP
    let rollCount = 0
    while( hp > 0 ) {
      const hitRoll = rollToHit()
      if ( hitRoll + aimedMod > dv ) {
        const {roll: damageRoll,crit} = rollDamage(dice)
        if (damageRoll > armor) {
          hp -= 2 * (damageRoll - armor)
          armor -= 1
          if (armor < 0) { armor = 0 }
          if (crit) { hp -= 5 }
        }
      }
      rollCount += 1
    }
    basicResults.push(rollCount)
  }
  for(let i = 0; i < NUM_TRAILS; i++) { 
    let armor = ENEMY_ARMOR - 11
    let hp = ENEMY_HP
    let rollCount = 0
    while( hp > 0 ) {
      const hitRoll = rollToHit()
      rollCount += 1
      if ( hitRoll + aimedMod > dv ) {
        const {roll:damageRoll,crit} = rollDamage(dice)
        if (damageRoll > armor) {
          hp -= damageRoll - armor
          armor -= 1
          if (armor < 0) { armor = 0 }
          if (crit) { hp -= 5 }
        }
      } else if ( dv - ( hitRoll + aimedMod ) < 4) {
        const hitReRoll = rollToHit()
        if (hitReRoll + 10 > dv) {
          const {roll:damageRoll,crit} = rollDamage(dice)
          if (damageRoll > armor) {
            hp -= 2 * (damageRoll - armor)
            armor -= 1
            if (armor < 0) { armor = 0 }
            if (crit) { hp -= 5 }
          }
        }
      }
    }
    smartResults.push(rollCount)
  }
  const controlStats = statify(controlResults, 'Turns to Kill', 'Standard Deviation')
  const basicStats = statify(basicResults, 'Turns to Kill', 'Standard Deviation')
  const smartStats = statify(smartResults, 'Turns to Kill', 'Standard Deviation')
  return {
    trial: {
      hp: ENEMY_HP,
      armor: ENEMY_ARMOR,
      dice,
      modifier,
      dv
    },
    'Basic Body Shots': controlStats,
    'Basic Head Shots': basicStats,
    'Smart Head Shots': smartStats,
  }
}

function homebrewFragTest(dice, modifier, dv){
  // turn to kill
  const basicResults = basicTurnsToKill(dice,modifier,dv)
  const homebrewResults = []
  for(let i = 0; i < NUM_TRAILS; i++) { 
    let armor = ENEMY_ARMOR
    let hp = ENEMY_HP
    let rollCount = 0
    while( hp > 0 ) {
      const hitRoll = rollToHit()
      rollCount += 1
      if ( hitRoll + modifier > dv ) {
        const {roll:damageRoll,crit} = rollDamage(dice)
        if (damageRoll > armor) {
          hp -= damageRoll - armor
          armor -= 1
          if (armor < 0) { armor = 0 }
          // console.log(`CRIT!`)
          if (crit) { hp -= 100 }
        }
      }
    }
    homebrewResults.push(rollCount)
  }
  const basicStats = statify(basicResults, 'Turns to Kill', 'Standard Deviation')
  const homebrewStats = statify(homebrewResults, 'Turns to Kill', 'Standard Deviation')
  return {
    trial: {
      hp: ENEMY_HP,
      armor: ENEMY_ARMOR,
      dice,
      modifier,
      dv
    },
    basic: basicStats,
    homebrew: homebrewStats,
  }
}

rifleRangeDVs = {
  '0-6m': 17,
  '7-12m': 16,
  '13-25m': 15,
  '26-50m': 13,
  '51-100m': 15,
}
autofireRangeDVs = {
  '0-6m': 22,
  '7-12m': 20,
  '13-25m': 17,
  '26-50m': 20,
  '51-100m': 25,
}

customAutofireRangeDVs = {
  '0-6m': 18,
  '7-12m': 17,
  '13-25m': 17,
  '26-50m': 17,
  '51-100m': 20,
}

rifleAutofireRangeDVs = {
  '0-6m': 20,
  '7-12m': 18,
  '13-25m': 19,
  '26-50m': 20,
  '51-100m': 22,
}

smgAutofireRangeDVs = {
  '0-6m': 19,
  '7-12m': 17,
  '13-25m': 19,
  '26-50m': 22,
  '51-100m': 25,
}

smgRangeDVs = {
  '0-6m': 15,
  '7-12m': 13,
  '13-25m': 15,
  '26-50m': 20,
  '51-100m': 25,
}


kerberosRangeDVs = {
  '0-6m': 22,
  '7-12m': 18,
  '13-25m': 18,
  '26-50m': 19,
  '51-100m': 21,
}

function zeusTest(modifier,range,enemyHP,enemyArmor) {
  const basicResults = basicTurnsToKill(5,modifier+2,rifleRangeDVs[range],25)
  const GeminiResults = basicTurnsToKill(4,modifier+2,rifleRangeDVs[range],20,2)
  const autofireGuaranteeDrumMagResults = autofireTurnsToKill(modifier+2,rifleAutofireRangeDVs[range],45,{guaranteedMultiplier: Math.floor((modifier-8)/3)})
  const scyllaResults = basicTurnsToKill(5,modifier,rifleRangeDVs[range],9,3)
  const zeusResults = zeusTurnsToKill(6,modifier,rifleRangeDVs[range])

  const basicStats = statify(basicResults, 'Turns to Kill', 'Standard Deviation', false)
  const geminiStats = statify(GeminiResults, 'Turns to Kill', 'Standard Deviation', false)
  const autofireStats = statify(autofireGuaranteeDrumMagResults, 'Turns to Kill', 'Standard Deviation', false)
  const scyllaStats = statify(scyllaResults, 'Turns to Kill', 'Standard Deviation', false)
  const zeusStats = statify(zeusResults, 'Turns to Kill', 'Standard Deviation', false)

  return {
    'Single Shots': basicStats,
    'Autofire ESD': autofireStats,
    'Gemini': geminiStats,
    'Scylla':  scyllaStats,
    'Zeus': zeusStats
  }
}

function kerberosTest(modifier,range, guarantee = undefined) {
  const basicResults = basicTurnsToKill(5,modifier+2,rifleRangeDVs[range],25)
  // const autofireResults = autofireTurnsToKill(modifier,autofireRangeDVs[range],25)
  // const autofireExtendedMagResults = autofireTurnsToKill(modifier,autofireRangeDVs[range],35)
  // const autofireDrumMagResults = autofireTurnsToKill(modifier,autofireRangeDVs[range],45)
  const GeminiResults = basicTurnsToKill(4,modifier+2,rifleRangeDVs[range],20,2)
  // const nonexcelKerberosResults = basicTurnsToKill(4,modifier,rifleRangeDVs[range],20,2)
  // const autofireAllDiceResults = []
  // const autofireRegularRangeResults = autofireTurnsToKill(modifier,rifleRangeDVs[range],25)
  // const autofireBothResults = []
  // const autofireCustomRangeTableResults = autofireTurnsToKill(modifier,customAutofireRangeDVs[range],25)
  // const autofireCustomRangeTableExtendedMagResults = autofireTurnsToKill(modifier,customAutofireRangeDVs[range],35)
  // const autofireCustomRangeTableDrumMagResults = autofireTurnsToKill(modifier,customAutofireRangeDVs[range],45)
  const autofireGuaranteeDrumMagResults = autofireTurnsToKill(modifier+2,rifleAutofireRangeDVs[range],45,{guaranteedMultiplier: guarantee ? guarantee : Math.floor((modifier-8)/3)})
  // const autofireCustomRangeTableGuaranteeDrumMagResults = autofireTurnsToKill(modifier,customAutofireRangeDVs2[range],45,guarantee ? guarantee : Math.floor((modifier-8)/3))
  // const autofireCustomRangeTableGuaranteeResults = autofireTurnsToKill(modifier,customAutofireRangeDVs2[range],25,guarantee ? guarantee : Math.floor((modifier-8)/3))
  // const autofireCustomRangeTableRollAllDiceResults = autofireTurnsToKill(modifier,customAutofireRangeDVs[range],25)
  // const helixResults = autofireTurnsToKill(modifier,customAutofireRangeDVs2[range],20,{maxAutoMod:5,guaranteedMultiplier: guarantee ? guarantee : Math.floor((modifier-8)/3),turnsToReload:2})
  const scyllaResults = basicTurnsToKill(5,modifier,rifleRangeDVs[range],9,3)
  // const kerberosMoreDiceResults = autofireTurnsToKill(modifier+1,kerberosRangeDVs[range],50,{maxAutoMod:5,guaranteedMultiplier: guarantee ? guarantee : Math.floor((modifier-8)/3)})
  // const kerberosD4sResults = autofireTurnsToKill(modifier+1,kerberosRangeDVs[range],50,{maxAutoMod:3,dieSize:4,diceAmount:4,guaranteedMultiplier: guarantee ? guarantee : Math.floor((modifier-8)/3)})
  // const kerberosGuaranteeResults = autofireTurnsToKill(modifier+1,kerberosRangeDVs[range],50,{maxAutoMod:4,guaranteedMultiplier: guarantee ? guarantee+1 : Math.floor((modifier-8)/3)+1 })
  // const referenceResults = basicTurnsToKill(4,modifier+2,smgRangeDVs[range],40)
  // const reference2Results = basicTurnsToKill(3,modifier+2,smgRangeDVs[range],40,2)
  // const smgResults = autofireTurnsToKill(modifier+2,smgAutofireRangeDVs[range],40,{guaranteedMultiplier: guarantee ? guarantee : Math.floor((modifier-8)/3), maxAutoMod: 3})
  const zeusResults = zeusTurnsToKill(6,modifier,rifleRangeDVs[range])
  const zeusTeamResults = zeusTurnsToKill(6,modifier,rifleRangeDVs[range], {magSize:99})

  const basicStats = statify(basicResults, 'Turns to Kill', 'Standard Deviation', false, true)
  const GeminiStats = statify(GeminiResults, 'Turns to Kill', 'Standard Deviation', false, true)
  // const nonexcelKerberosStats = statify(nonexcelKerberosResults, 'Turns to Kill', 'Standard Deviation')
  // const autofireStats = statify(autofireResults, 'Turns to Kill', 'Standard Deviation')
  // const autofireExtendedMagStats = statify(autofireExtendedMagResults, 'Turns to Kill', 'Standard Deviation')
  // const autofireDrumMagStats = statify(autofireDrumMagResults, 'Turns to Kill', 'Standard Deviation')
  // const autofireAllDiceStats = statify(autofireAllDiceResults, 'Turns to Kill', 'Standard Deviation')
  // const autofireRegularRangeStats = statify(autofireRegularRangeResults, 'Turns to Kill', 'Standard Deviation')
  // const autofireBothStats = statify(autofireBothResults, 'Turns to Kill', 'Standard Deviation')
  // const customAutofireStats = statify(autofireCustomRangeTableResults, 'Turns to Kill', 'Standard Deviation', false)
  // const customAutofireExtendedMagStats = statify(autofireCustomRangeTableExtendedMagResults, 'Turns to Kill', 'Standard Deviation', false)
  // const customAutofireDrumMagStats = statify(autofireCustomRangeTableDrumMagResults, 'Turns to Kill', 'Standard Deviation', false)
  const guaranteeAutofireDrumMagStats = statify(autofireGuaranteeDrumMagResults, 'Turns to Kill', 'Standard Deviation', false, true)
  // const customGuaranteeAutofireDrumMagStats = statify(autofireCustomRangeTableGuaranteeDrumMagResults, 'Turns to Kill', 'Standard Deviation', false)
  // const customGuaranteeAutofireStats = statify(autofireCustomRangeTableGuaranteeResults, 'Turns to Kill', 'Standard Deviation', false)
  // const helixStats = statify(helixResults, 'Turns to Kill', 'Standard Deviation', false)
  const scyllaStats = statify(scyllaResults, 'Turns to Kill', 'Standard Deviation', false, true)
  // const kerberosMoreDiceStats = statify(kerberosMoreDiceResults, 'Turns to Kill', 'Standard Deviation', false)
  // const kerberosD4sStats = statify(kerberosD4sResults, 'Turns to Kill', 'Standard Deviation', false)
  // const kerberosGuaranteeStats = statify(kerberosGuaranteeResults, 'Turns to Kill', 'Standard Deviation', false)
  // const referenceStats = statify(referenceResults, 'Turns to Kill', 'Standard Deviation', false)
  // const reference2Stats = statify(reference2Results, 'Turns to Kill', 'Standard Deviation', false)
  // const smgStats = statify(smgResults, 'Turns to Kill', 'Standard Deviation', false)
  const zeusStats = statify(zeusResults, 'Turns to Kill', 'Standard Deviation', false, true)
  const zeusTeamStats = statify(zeusTeamResults, 'Turns to Kill', 'Standard Deviation', false, true)

  return {
    // trial: {
    //   // hp: ENEMY_HP,
    //   // armor: ENEMY_ARMOR,
    //   modifier,
    //   range
    // },
    'Single Shots': basicStats,
    'Autofire ESD': guaranteeAutofireDrumMagStats,
    // 'SMG Auto ESD': smgStats,
    // '4d6 Reference': referenceStats,
    // '3d6x2 Reference': reference2Stats,
    'Gemini': GeminiStats,
    // 'Helix': helixStats,
    'Scylla': scyllaStats,
    'Zeus': zeusStats,
    'Zeus (Team)': zeusTeamStats,
    // 'Kerberos x5': kerberosMoreDiceStats,
    // 'Kerberos 4d4x3': kerberosD4sStats,
    // 'Kerberos +1': kerberosGuaranteeStats,
    // 'Non-Excellent Kerberos': nonexcelKerberosStats,
    // 'Autofire - RAW': autofireStats,
    // 'Autofire - RAW (Extendo)': autofireExtendedMagStats,
    // 'Autofire - RAW (Drum)': autofireDrumMagStats,
    // // 'Autofire - roll all dice': autofireAllDiceStats,
    // // 'Autofire - regular rifle DVs': autofireRegularRangeStats,
    // // 'Autofire - roll all dice and regular DVs': autofireBothStats,
    // 'Autofire - Custom Range Table': customAutofireStats,
    // 'Autofire - Custom Range Table (Extendo)': customAutofireExtendedMagStats,
    // 'Autofire - Custom Range Table (Drum)': customAutofireDrumMagStats,
    // 'Autofire - Guaranteed Mod (Drum)': guaranteeAutofireDrumMagStats,
    // 'New Autofire ': customGuaranteeAutofireStats,
    // 'New Autofire (Drum)': customGuaranteeAutofireDrumMagStats,
  }
}


// const armorPiercingData = {
//   'Heavy SMG': armorPiercingTest(3),
//   'Very Heavy Pistol': armorPiercingTest(4),
//   'Rifle': armorPiercingTest(5)
// }

// const expandingData = {
//   'Heavy SMG': 0.07407 * 0.16667,
//   'Very Heavy Pistol': 0.13194 * 0.16667,
//   'Rifle': 0.19624 * 0.16667
// }

// const incendaryData = {
//   'Roll with It': {
//     'Heavy SMG': incendaryTestLeaveIt(3,14,15),
//     'Very Heavy Pistol': incendaryTestLeaveIt(4,14,15),
//     'Rifle': incendaryTestLeaveIt(5,14,15)
//   },
//   'Put it Out': {
//     'Heavy SMG': incendaryTestPutItOut(3,14,15),
//     'Very Heavy Pistol': incendaryTestPutItOut(4,14,15),
//     'Rifle': incendaryTestPutItOut(5,14,15)
//   }
// }

// const smartData = {
//   'Regular Shots': {
//     'DV 13': {
//       // 'Heavy SMG': smartTest(3,14,13),
//       // 'Very Heavy Pistol': smartTest(4,14,13),
//       'Rifle': smartTest(5,13,13)
//     },
//     'DV 15': {
//       // 'Heavy SMG': smartTest(3,14,15),
//       // 'Very Heavy Pistol': smartTest(4,14,15),
//       'Rifle': smartTest(5,13,15)
//     },
//     'DV 16': {
//       // 'Heavy SMG': smartTest(3,14,16),
//       // 'Very Heavy Pistol': smartTest(4,14,16),
//       'Rifle': smartTest(5,13,16)
//     },
//     'DV 17': {
//       // 'Heavy SMG': smartTest(3,14,17),
//       // 'Very Heavy Pistol': smartTest(4,14,17),
//       'Rifle': smartTest(5,13,17)
//     },
//     'DV 20': {
//       // 'Heavy SMG': smartTest(3,14,20),
//       // 'Very Heavy Pistol': smartTest(4,14,20),
//       'Rifle': smartTest(5,13,20)
//     },
//   },
//   'Aimed Shots': {
//     'DV 13': {
//       // 'Heavy SMG': smartTest(3,7,13),
//       // 'Very Heavy Pistol': smartTest(4,7,13),
//       'Rifle': smartTest(5,6,13)
//     },
//     'DV 15': {
//       // 'Heavy SMG': smartTest(3,7,15),
//       // 'Very Heavy Pistol': smartTest(4,7,15),
//       'Rifle': smartTest(5,6,15)
//     },
//     'DV 16': {
//       // 'Heavy SMG': smartTest(3,7,16),
//       // 'Very Heavy Pistol': smartTest(4,7,16),
//       'Rifle': smartTest(5,6,16)
//     },
//     'DV 17': {
//       // 'Heavy SMG': smartTest(3,7,17),
//       // 'Very Heavy Pistol': smartTest(4,7,17),
//       'Rifle': smartTest(5,6,17)
//     },
//     'DV 20': {
//       // 'Heavy SMG': smartTest(3,7,20),
//       // 'Very Heavy Pistol': smartTest(4,7,20),
//       'Rifle': smartTest(5,6,20)
//     },
//   }
// }

// const homebrewData = {
//   'DV 13': {
//     'Heavy SMG': homebrewFragTest(3,14,13),
//     'Very Heavy Pistol': homebrewFragTest(4,14,13),
//     'Rifle': homebrewFragTest(5,14,13)
//   },
//   'DV 15': {
//     'Heavy SMG': homebrewFragTest(3,14,15),
//     'Very Heavy Pistol': homebrewFragTest(4,14,15),
//     'Rifle': homebrewFragTest(5,14,15)
//   },
//   'DV 20': {
//     'Heavy SMG': homebrewFragTest(3,14,20),
//     'Very Heavy Pistol': homebrewFragTest(4,14,20),
//     'Rifle': homebrewFragTest(5,14,20)
//   },
// }

// const bigGunsData = {
//   '0-6m': kerberosTest(14,'0-6m'),
//   '7-12m': kerberosTest(14,'7-12m'),
//   '13-25m': kerberosTest(14,'13-25m'),
//   '26-50m': kerberosTest(14,'26-50m'),
//   '51-100m': kerberosTest(14,'51-100m'),
// }

const autofireData = {
  '0-6m': {
    // '12 skill': kerberosTest(12,'0-6m'),
    'REF 8 +3 Autofire': kerberosTest(11,'0-6m'),
    // 'REF 8 +4 Autofire': kerberosTest(12,'0-6m'),
    'REF 8 +5 Autofire': kerberosTest(13,'0-6m'),
    'REF 8 +6 Autofire': kerberosTest(14,'0-6m'),
    'REF 8 +7 Autofire': kerberosTest(15,'0-6m'),
    'REF 8 +9 Autofire': kerberosTest(17,'0-6m'),
  },
  '7-12m': {
    // '12 skill': kerberosTest(12,'7-12m'),
    'REF 8 +3 Autofire': kerberosTest(11,'7-12m'),
    // 'REF 8 +4 Autofire': kerberosTest(12,'7-12m'),
    'REF 8 +5 Autofire': kerberosTest(13,'7-12m'),
    'REF 8 +6 Autofire': kerberosTest(14,'7-12m'),
    'REF 8 +7 Autofire': kerberosTest(15,'7-12m'),
    'REF 8 +9 Autofire': kerberosTest(17,'7-12m'),
  },
  '13-25m': {
    // '12 skill': kerberosTest(12,'13-25m'),
    'REF 8 +3 Autofire': kerberosTest(11,'13-25m'),
    // 'REF 8 +4 Autofire': kerberosTest(12,'13-25m'),
    'REF 8 +5 Autofire': kerberosTest(13,'13-25m'),
    'REF 8 +6 Autofire': kerberosTest(14,'13-25m'),
    'REF 8 +7 Autofire': kerberosTest(15,'13-25m'),
    'REF 8 +9 Autofire': kerberosTest(17,'13-25m'),
  },
  '26-50m': {
    // '12 skill': kerberosTest(12,'26-50m'),
    'REF 8 +3 Autofire': kerberosTest(11,'26-50m'),
    // 'REF 8 +4 Autofire': kerberosTest(12,'26-50m'),
    'REF 8 +5 Autofire': kerberosTest(13,'26-50m'),
    'REF 8 +6 Autofire': kerberosTest(14,'26-50m'),
    'REF 8 +7 Autofire': kerberosTest(15,'26-50m'),
    'REF 8 +9 Autofire': kerberosTest(17,'26-50m'),
  },
  '51-100m': {
    // '12 skill': kerberosTest(12,'51-100m'),
    'REF 8 +3 Autofire': kerberosTest(11,'51-100m'),
    // 'REF 8 +4 Autofire': kerberosTest(12,'51-100m'),
    'REF 8 +5 Autofire': kerberosTest(13,'51-100m'),
    'REF 8 +6 Autofire': kerberosTest(14,'51-100m'),
    'REF 8 +7 Autofire': kerberosTest(15,'51-100m'),
    'REF 8 +9 Autofire': kerberosTest(17,'51-100m'),
  },
}

// const headshotData = {
//   Rifle: {
//     'DV 13': headshotsTest(5,13,13),
//     'DV 15': headshotsTest(5,13,15),
//     'DV 16': headshotsTest(5,13,16),
//     'DV 17': headshotsTest(5,13,17),
//     'DV 20': headshotsTest(5,13,20),
//   }
// }

// const armorData = {
//   'DV 15': {
//     'Heavy SMG': armorTest(3,14,15),
//     'Very Heavy Pistol': armorTest(4,14,15),
//     'Rifle': armorTest(5,14,15),
//   },
//   'DV 20': {
//     'Heavy SMG': armorTest(3,14,20),
//     'Very Heavy Pistol': armorTest(4,14,20),
//     'Rifle': armorTest(5,14,20),
//   }
// }

const allData = {
  // expandingAmmo: expandingData,
  // armorPiercingAmmo: armorPiercingData,
  // incendaryAmmo: incendaryData,
  // smartAmmo:smartData,
  // homebrewAmmo:homebrewData,
  autofireData,
  // bigGunsData,
  // headshotData
  // armorData
}

fs.writeFileSync('results.json',JSON.stringify(allData,undefined,2))