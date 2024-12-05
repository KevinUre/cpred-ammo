const fs = require('fs')
const mathjs = require('mathjs')

const NUM_TRAILS = 100000
const ENEMY_HP = 40
const ENEMY_ARMOR = 11

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

function rollDamage(dice) {
  let sum = 0;
  let sixCount = 0;
  for (let i = 0; i < dice; i++) {
    const die = Math.floor(Math.random()*6)+1
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

function statify(data, averageLabel, stddevLabel) {
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
  return results
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

function autofireTurnsToKill(modifier,dv) {
  const results = []
  for(let i = 0; i < NUM_TRAILS; i++) { 
    let armor = ENEMY_ARMOR
    let hp = ENEMY_HP
    let rollCount = 0
    while( hp > 0 ) {
      const hitRoll = rollToHit()
      rollCount += 1
      if ( hitRoll + modifier > dv ) {
        const multi = Math.min(hitRoll + modifier - dv,4)
        let {roll: damageRoll,crit} = rollDamage(2)
        damageRoll *= multi
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

function basicTurnsToKill(dice, modifier, dv, rof) {
  const rateOfFire = rof ?? 1
  // turn to kill
  const results = []
  for(let i = 0; i < NUM_TRAILS; i++) { 
    let armor = ENEMY_ARMOR
    let hp = ENEMY_HP
    let rollCount = 0
    while( hp > 0 ) {
      for (let s = 0; s < rateOfFire; s++)
      {
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
      rollCount += 1
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
}

autofireRangeDVs = {
  '0-6m': 22,
  '7-12m': 20,
  '13-25m': 17,
  '26-50m': 20,
}

function kerberosTest(modifier,range) {
  const basicResults = basicTurnsToKill(5,modifier,rifleRangeDVs[range])
  const autofireResults = autofireTurnsToKill(modifier,autofireRangeDVs[range])
  const kerberosResults = basicTurnsToKill(4,modifier,rifleRangeDVs[range],2)
  const nonexcelKerberosResults = basicTurnsToKill(4,modifier-1,rifleRangeDVs[range],2)
  const basicStats = statify(basicResults, 'Turns to Kill', 'Standard Deviation')
  const kerberosStats = statify(kerberosResults, 'Turns to Kill', 'Standard Deviation')
  const nonexcelKerberosStats = statify(nonexcelKerberosResults, 'Turns to Kill', 'Standard Deviation')
  const autofireStats = statify(autofireResults, 'Turns to Kill', 'Standard Deviation')
  return {
    trial: {
      hp: ENEMY_HP,
      armor: ENEMY_ARMOR,
      modifier,
      range
    },
    basic: basicStats,
    autofire: autofireStats,
    kerberos: kerberosStats,
    'Non-Excellent Kerberos': nonexcelKerberosStats,
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

// const kerberosData = {
//   '0-6m': kerberosTest(13,'0-6m'),
//   '7-12m': kerberosTest(13,'7-12m'),
//   '13-25m': kerberosTest(13,'13-25m'),
//   '26-50m': kerberosTest(13,'26-50m'),
// }

// const headshotData = {
//   Rifle: {
//     'DV 13': headshotsTest(5,13,13),
//     'DV 15': headshotsTest(5,13,15),
//     'DV 16': headshotsTest(5,13,16),
//     'DV 17': headshotsTest(5,13,17),
//     'DV 20': headshotsTest(5,13,20),
//   }
// }

const armorData = {
  'DV 15': {
    'Heavy SMG': armorTest(3,14,15),
    'Very Heavy Pistol': armorTest(4,14,15),
    'Rifle': armorTest(5,14,15),
  },
  'DV 20': {
    'Heavy SMG': armorTest(3,14,20),
    'Very Heavy Pistol': armorTest(4,14,20),
    'Rifle': armorTest(5,14,20),
  }
}

const allData = {
  // expandingAmmo: expandingData,
  // armorPiercingAmmo: armorPiercingData,
  // incendaryAmmo: incendaryData,
  // smartAmmo:smartData,
  // homebrewAmmo:homebrewData,
  // kerberosData,
  // headshotData
  armorData
}

fs.writeFileSync('results.json',JSON.stringify(allData,undefined,2))