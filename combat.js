const fs = require('fs')
const mathjs = require('mathjs')
var _ = require('lodash');

const NUM_TRAILS = 1000
const DODGE_THRESHOLD = 4 // 60% chance to dodge
const RUN_THRESHOLD = 20 // run instead of shooting if your shot is worse than this
const STARTING_DISTANCE = 50

function createRangeTable(
  zeroToSix, sevenToTwelve, thirteenToTwentyFive,
  twentySixToFifty, fiftyToOneHundred
) {
  const func = (r) => {
    if (r <= 3) { return zeroToSix }
    if (r <= 6) { return sevenToTwelve }
    if (r <= 12) { return thirteenToTwentyFive }
    if (r <= 25) { return twentySixToFifty }
    if (r <= 50) { return fiftyToOneHundred }
  }
  return func
}

function createGun(
  name, damageDice, rateOfFire, maxAmmo,
  bestRangeLow,bestRangeHigh,rangeTable, autoFire=false
) {
  return {
    name,
    damageDice,
    rateOfFire,
    maxAmmo,
    bestRangeLow,
    bestRangeHigh,
    rangeTable,
    autoFire
  }
}

function createSword(
  name, damageDice, rateOfFire
) {
  return {
    name,
    damageDice,
    rateOfFire
  }
}

function createCombatant(
  name, hp, bodyArmor, speed,
  initiative, shoot, melee, evade, canDodgeBullets,
  gun, sword
) {
  const combatant = {
    name,
    hp,
    maxHP: hp,
    bodyArmor,
    speed,
    skills: {
      initiative,
      shoot,
      melee,
      evade,
      canDodgeBullets
    },
    gun,
    sword
  }
  combatant.gun.ammo = combatant.gun.maxAmmo
  combatant.wounded = () => {return combatant.hp <= Math.floor(combatant.maxHP/2)}
  return combatant
}

const heavyPistol = createGun('HP',3,2,8,0,3,createRangeTable(13,15,20,25,30))
const veryHeavyPistol = createGun('VHP',4,1,8,0,3,createRangeTable(13,15,20,25,30))
const smg = createGun('smg',2,1,30,4,6,createRangeTable(15,13,15,20,25))
const hsmg = createGun('hsmg',3,1,40,4,6,createRangeTable(15,13,15,20,25))
// const autoSmg = createGun('auto-smg',3,1,3,4,6,createRangeTable(15,13,15,20,25))
// const autoHsmg = createGun('auto-hsmg',3,1,4,4,6,createRangeTable(15,13,15,20,25))
const shotgun = createGun('shotty',5,1,4,0,3,createRangeTable(13,15,20,25,30))
const rifle = createGun('AR',5,1,25,13,25,createRangeTable(17,16,15,13,15))
// const autoRifle = createGun('auto-AR',5,1,25,13,25,createRangeTable(17,16,15,13,15))
const sword = createSword('katana',3,2)

function rollSkill() {
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

function simulateCombat(combatantOne, combatantTwo, startingDistance) {
  let oneWins = 0
  let twoWins = 0
  for(let round = 0; round < NUM_TRAILS; round++) {
    let distance = startingDistance
    let startingCharacter = undefined
    let trailingCharacter = undefined
    let startIsOne = false;
    while(startingCharacter == undefined) {
      let oneInitRoll = rollSkill()+combatantOne.skills.initiative
      let twoInitRoll = rollSkill()+combatantTwo.skills.initiative
      if(oneInitRoll > twoInitRoll) {
        startingCharacter = _.cloneDeep(combatantOne)
        trailingCharacter = _.cloneDeep(combatantTwo)
        startIsOne = true
      } else if (twoInitRoll > oneInitRoll) {
        startingCharacter = _.cloneDeep(combatantTwo)
        trailingCharacter = _.cloneDeep(combatantOne)
      }
    }
    while(startingCharacter.hp > 0 && trailingCharacter.hp > 0) {
      // initiative winner
      if(distance > startingCharacter.gun.bestRangeHigh || startingCharacter.sword) {
        // move to better range
        distance -= startingCharacter.speed
        if (distance < 0) { distance = 0 }
      }
      if (distance > 0 || startingCharacter.sword == undefined) {
        if(startingCharacter.gun.rangeTable(distance) > RUN_THRESHOLD) {
          // sprint
          distance -= startingCharacter.speed
          if (distance < 0) { distance = 0 }
        } else {
          if(startingCharacter.gun.ammo < startingCharacter.gun.rateOfFire) {
            // reload
            startingCharacter.gun.ammo = startingCharacter.gun.maxAmmo
          } else {
            // shoot
            for(let shot = 0; shot < startingCharacter.gun.rateOfFire; shot++){
              let dv = startingCharacter.gun.rangeTable(distance)
              if(trailingCharacter.skills.canDodgeBullets && 
                trailingCharacter.skills.evade + DODGE_THRESHOLD >= dv) {
                dv = trailingCharacter.skills.evade + rollSkill() + (trailingCharacter.wounded() ? -2 : 0)
              }
              const toHit = rollSkill() + startingCharacter.skills.shoot + (startingCharacter.wounded() ? -2 : 0)
              startingCharacter.gun.ammo -= 1
              if(toHit > dv) {
                const {roll:damageRoll,crit} = rollDamage(startingCharacter.gun.damageDice)
                if(damageRoll > trailingCharacter.bodyArmor) {
                  trailingCharacter.hp -= damageRoll - trailingCharacter.bodyArmor
                  trailingCharacter.bodyArmor -= 1
                  if(trailingCharacter.bodyArmor < 0) { trailingCharacter.bodyArmor = 0}
                  if(crit) {trailingCharacter.hp -= 5}
                }
              }
            }
          }
        }
      } else if(startingCharacter.sword){
        // melee
        for(let swing = 0; swing < startingCharacter.sword.rateOfFire; swing++){
          let dv = trailingCharacter.skills.evade + rollSkill() + (trailingCharacter.wounded() ? -2 : 0)
          const toHit = rollSkill() + startingCharacter.skills.melee + (startingCharacter.wounded() ? -2 : 0)
          if(toHit > dv) {
            const {roll:damageRoll,crit} = rollDamage(startingCharacter.sword.damageDice)
            if(damageRoll > Math.floor(trailingCharacter.bodyArmor/2)) {
              trailingCharacter.hp -= damageRoll - Math.floor(trailingCharacter.bodyArmor/2)
              trailingCharacter.bodyArmor -= 1
              if(trailingCharacter.bodyArmor < 0) { trailingCharacter.bodyArmor = 0}
              if(crit) {trailingCharacter.hp -= 5}
            }
          }
        }
      }
      // trailing
      if(trailingCharacter.hp > 0) {
        if(distance > trailingCharacter.gun.bestRangeHigh || trailingCharacter.sword) {
          //move to better range
          distance -= trailingCharacter.speed
          if (distance < 0) { distance = 0 }
        }
        if (distance > 0 || trailingCharacter.sword == undefined) {
          if(trailingCharacter.gun.rangeTable(distance) > RUN_THRESHOLD) {
            //sprint
            distance -= trailingCharacter.speed
            if (distance < 0) { distance = 0 }
          } else {
            if(trailingCharacter.gun.ammo < trailingCharacter.gun.rateOfFire) {
              // reload
              trailingCharacter.gun.ammo = trailingCharacter.gun.maxAmmo
            } else {
              // shoot
              for(let shot = 0; shot < trailingCharacter.gun.rateOfFire; shot++){
                let dv = trailingCharacter.gun.rangeTable(distance)
                if(startingCharacter.skills.canDodgeBullets && 
                  startingCharacter.skills.evade + DODGE_THRESHOLD >= dv) {
                  dv = startingCharacter.skills.evade + rollSkill() + (startingCharacter.wounded() ? -2 : 0)
                }
                const toHit = rollSkill() + trailingCharacter.skills.shoot + (trailingCharacter.wounded() ? -2 : 0)
                trailingCharacter.gun.ammo -= 1
                if(toHit > dv) {
                  const {roll:damageRoll,crit} = rollDamage(trailingCharacter.gun.damageDice)
                  if(damageRoll > startingCharacter.bodyArmor) {
                    startingCharacter.hp -= damageRoll - startingCharacter.bodyArmor
                    startingCharacter.bodyArmor -= 1
                    if(startingCharacter.bodyArmor < 0) { startingCharacter.bodyArmor = 0}
                    if(crit) {startingCharacter.hp -= 5}
                  }
                }
              }
            }
          }
        } else if(trailingCharacter.sword){
          // melee
          for(let swing = 0; swing < trailingCharacter.sword.rateOfFire; swing++){
            let dv = startingCharacter.skills.evade + rollSkill() + (startingCharacter.wounded() ? -2 : 0)
            const toHit = rollSkill() + trailingCharacter.skills.melee + (trailingCharacter.wounded() ? -2 : 0)
            if(toHit > dv) {
              const {roll:damageRoll,crit} = rollDamage(trailingCharacter.sword.damageDice)
              if(damageRoll > Math.floor(startingCharacter.bodyArmor/2)) {
                startingCharacter.hp -= damageRoll - Math.floor(startingCharacter.bodyArmor/2)
                startingCharacter.bodyArmor -= 1
                if(startingCharacter.bodyArmor < 0) { startingCharacter.bodyArmor = 0}
                if(crit) {startingCharacter.hp -= 5}
              }
            }
          }
        }
      }
    }
    if(startingCharacter.hp > 0) { if(startIsOne) {oneWins++} else {twoWins++} }
    if(trailingCharacter.hp > 0) { if(startIsOne) {twoWins++} else {oneWins++} }
  }

  const results = {
  //   parameters: {
  //     startingDistance,
  //     combatantOne,
  //     combatantTwo,
  //   },
  //   results: {},
  // }
  // results.results[`${combatantOne.name}`] = (oneWins/NUM_TRAILS*100).toFixed(2)
  // results.results[`${combatantTwo.name}`] = (twoWins/NUM_TRAILS*100).toFixed(2)
  }
  // results[`${combatantOne.name}`] = (oneWins/NUM_TRAILS*100).toFixed(2)
  results[`${combatantTwo.name}`] = (twoWins/NUM_TRAILS*100).toFixed(2)
  return results
}

const results = {}

results['armor can dodge'] = {}

results['armor can dodge']['10 evade'] = {}
results['armor can dodge']['12 evade'] = {}
results['armor can dodge']['14 evade'] = {}

results['armor can dodge']['10 evade']['laj'] = simulateCombat(
  createCombatant('Light Rifleman',40,11,6,8,10,10,10,false, _.cloneDeep(veryHeavyPistol), undefined),
  createCombatant('Light Dodge Rifleman',40,11,6,8,10,10,10,true, _.cloneDeep(veryHeavyPistol), undefined),
  30
)['Light Dodge Rifleman']
results['armor can dodge']['10 evade']['haj'] = simulateCombat(
  createCombatant('Light Rifleman',40,11,6,8,10,10,10,false, _.cloneDeep(veryHeavyPistol), undefined),
  createCombatant('Medium Rifleman',40,13,6,6,10,10,8,true, _.cloneDeep(veryHeavyPistol), undefined),
  30
)['Medium Rifleman']
results['armor can dodge']['10 evade']['flak'] = simulateCombat(
  createCombatant('Light Rifleman',40,11,6,8,10,10,10,false, _.cloneDeep(veryHeavyPistol), undefined),
  createCombatant('Heavy Rifleman',40,15,6,4,10,10,6,true, _.cloneDeep(veryHeavyPistol), undefined),
  30
)['Heavy Rifleman']

results['armor can dodge']['12 evade']['laj'] = simulateCombat(
  createCombatant('Light Rifleman',40,11,6,8,10,10,12,false, _.cloneDeep(rifle), undefined),
  createCombatant('Light Dodge Rifleman',40,11,6,8,10,10,12,true, _.cloneDeep(rifle), undefined),
  30
)['Light Dodge Rifleman']
results['armor can dodge']['12 evade']['haj'] = simulateCombat(
  createCombatant('Light Rifleman',40,11,6,8,10,10,12,false, _.cloneDeep(rifle), undefined),
  createCombatant('Medium Rifleman',40,13,6,6,10,10,10,true, _.cloneDeep(rifle), undefined),
  30
)['Medium Rifleman']
results['armor can dodge']['12 evade']['flak'] = simulateCombat(
  createCombatant('Light Rifleman',40,11,6,8,10,10,12,false, _.cloneDeep(rifle), undefined),
  createCombatant('Heavy Rifleman',40,15,6,4,10,10,8,true, _.cloneDeep(rifle), undefined),
  30
)['Heavy Rifleman']

results['armor can dodge']['14 evade']['laj'] = simulateCombat(
  createCombatant('Light Rifleman',40,11,6,8,10,10,14,false, _.cloneDeep(rifle), undefined),
  createCombatant('Light Dodge Rifleman',40,11,6,8,10,10,14,true, _.cloneDeep(rifle), undefined),
  30
)['Light Dodge Rifleman']
results['armor can dodge']['14 evade']['haj'] = simulateCombat(
  createCombatant('Light Rifleman',40,11,6,8,10,10,14,false, _.cloneDeep(rifle), undefined),
  createCombatant('Medium Rifleman',40,13,6,6,10,10,12,true, _.cloneDeep(rifle), undefined),
  30
)['Medium Rifleman']
results['armor can dodge']['14 evade']['flak'] = simulateCombat(
  createCombatant('Light Rifleman',40,11,6,8,10,10,14,false, _.cloneDeep(rifle), undefined),
  createCombatant('Heavy Rifleman',40,15,6,4,10,10,10,true, _.cloneDeep(rifle), undefined),
  30
)['Heavy Rifleman']

results['armor cannot dodge'] = {}

results['armor cannot dodge']['10 evade'] = {}
results['armor cannot dodge']['12 evade'] = {}
results['armor cannot dodge']['14 evade'] = {}

results['armor cannot dodge']['10 evade']['laj'] = simulateCombat(
  createCombatant('Light Rifleman',40,11,6,8,10,10,10,false, _.cloneDeep(rifle), undefined),
  createCombatant('Light Dodge Rifleman',40,11,6,8,10,10,10,true, _.cloneDeep(rifle), undefined),
  30
)['Light Dodge Rifleman']
results['armor cannot dodge']['10 evade']['haj'] = simulateCombat(
  createCombatant('Light Rifleman',40,11,6,8,10,10,10,false, _.cloneDeep(rifle), undefined),
  createCombatant('Medium Rifleman',40,13,6,6,10,10,8,false, _.cloneDeep(rifle), undefined),
  30
)['Medium Rifleman']
results['armor cannot dodge']['10 evade']['flak'] = simulateCombat(
  createCombatant('Light Rifleman',40,11,6,8,10,10,10,false, _.cloneDeep(rifle), undefined),
  createCombatant('Heavy Rifleman',40,15,6,4,10,10,6,false, _.cloneDeep(rifle), undefined),
  30
)['Heavy Rifleman']

results['armor cannot dodge']['12 evade']['laj'] = simulateCombat(
  createCombatant('Light Rifleman',40,11,6,8,10,10,12,false, _.cloneDeep(rifle), undefined),
  createCombatant('Light Dodge Rifleman',40,11,6,8,10,10,12,true, _.cloneDeep(rifle), undefined),
  30
)['Light Dodge Rifleman']
results['armor cannot dodge']['12 evade']['haj'] = simulateCombat(
  createCombatant('Light Rifleman',40,11,6,8,10,10,12,false, _.cloneDeep(rifle), undefined),
  createCombatant('Medium Rifleman',40,13,6,6,10,10,10,false, _.cloneDeep(rifle), undefined),
  30
)['Medium Rifleman']
results['armor cannot dodge']['12 evade']['flak'] = simulateCombat(
  createCombatant('Light Rifleman',40,11,6,8,10,10,12,false, _.cloneDeep(rifle), undefined),
  createCombatant('Heavy Rifleman',40,15,6,4,10,10,8,false, _.cloneDeep(rifle), undefined),
  30
)['Heavy Rifleman']

results['armor cannot dodge']['14 evade']['laj'] = simulateCombat(
  createCombatant('Light Rifleman',40,11,6,8,10,10,14,false, _.cloneDeep(rifle), undefined),
  createCombatant('Light Dodge Rifleman',40,11,6,8,10,10,14,true, _.cloneDeep(rifle), undefined),
  30
)['Light Dodge Rifleman']
results['armor cannot dodge']['14 evade']['haj'] = simulateCombat(
  createCombatant('Light Rifleman',40,11,6,8,10,10,14,false, _.cloneDeep(rifle), undefined),
  createCombatant('Medium Rifleman',40,13,6,6,10,10,12,false, _.cloneDeep(rifle), undefined),
  30
)['Medium Rifleman']
results['armor cannot dodge']['14 evade']['flak'] = simulateCombat(
  createCombatant('Light Rifleman',40,11,6,8,10,10,14,false, _.cloneDeep(rifle), undefined),
  createCombatant('Heavy Rifleman',40,15,6,4,10,10,10,false, _.cloneDeep(rifle), undefined),
  30
)['Heavy Rifleman']

// results['Heavy Sword vs Rifle'] = simulateCombat(
//   createCombatant('Heavy Armorjack Swordsman',40,13,6,6,10,10,8,false, _.cloneDeep(heavyPistol), _.cloneDeep(sword)),
//   // createCombatant('Light Armorjack Swordsman',40,11,6,8,10,10,10,false, _.cloneDeep(heavyPistol), _.cloneDeep(sword)),
//   createCombatant('Light Armorjack Rifleman',40,11,6,8,10,10,10,true, _.cloneDeep(rifle), undefined),
//   30
// )

// results['Heavy Sword vs Shotgun'] = simulateCombat(
//   createCombatant('Heavy Armorjack Swordsman',40,13,6,6,10,10,8,false, _.cloneDeep(heavyPistol), _.cloneDeep(sword)),
//   // createCombatant('Light Armorjack Swordsman',40,11,6,8,10,10,10,false, _.cloneDeep(heavyPistol), _.cloneDeep(sword)),
//   createCombatant('Light Armorjack Shotgun',40,11,6,8,10,10,10,true, _.cloneDeep(shotgun), undefined),
//   30
// )

// results['Heavy Sword vs Light Sword'] = simulateCombat(
//   createCombatant('Heavy Armorjack Swordsman',40,13,6,6,10,10,8,false, _.cloneDeep(heavyPistol), _.cloneDeep(sword)),
//   // createCombatant('Light Armorjack Swordsman 1',40,11,6,8,10,10,10,false, _.cloneDeep(heavyPistol), _.cloneDeep(sword)),
//   createCombatant('Light Armorjack Swordsman',40,11,6,8,10,10,10,true, _.cloneDeep(heavyPistol), _.cloneDeep(sword)),
//   30
// )

// results['Dodge Sword vs Rifle'] = simulateCombat(
//   createCombatant('Light Armorjack Dodge Swordsman',40,11,6,8,10,10,10,true, _.cloneDeep(heavyPistol), _.cloneDeep(sword)),
//   // createCombatant('Light Armorjack Swordsman',40,11,6,8,10,10,10,false, _.cloneDeep(heavyPistol), _.cloneDeep(sword)),
//   createCombatant('Light Armorjack Rifleman',40,11,6,8,10,10,10,true, _.cloneDeep(rifle), undefined),
//   30
// )

// results['Dodge Sword vs Shotgun'] = simulateCombat(
//   createCombatant('Light Armorjack Dodge Swordsman',40,11,6,8,10,10,10,true, _.cloneDeep(heavyPistol), _.cloneDeep(sword)),
//   // createCombatant('Light Armorjack Swordsman',40,11,6,8,10,10,10,false, _.cloneDeep(heavyPistol), _.cloneDeep(sword)),
//   createCombatant('Light Armorjack Shotgun',40,11,6,8,10,10,10,true, _.cloneDeep(shotgun), undefined),
//   30
// )

// results['Dodge Sword vs Light Sword'] = simulateCombat(
//   createCombatant('Light Armorjack Dodge Swordsman',40,11,6,8,10,10,10,true, _.cloneDeep(heavyPistol), _.cloneDeep(sword)),
//   // createCombatant('Light Armorjack Swordsman 1',40,11,6,8,10,10,10,false, _.cloneDeep(heavyPistol), _.cloneDeep(sword)),
//   createCombatant('Light Armorjack Swordsman',40,11,6,8,10,10,10,true, _.cloneDeep(heavyPistol), _.cloneDeep(sword)),
//   30
// )

// results['Heavy Rifle vs Rifle'] = simulateCombat(
//   createCombatant('Heavy Armorjack Rifleman',40,13,6,6,10,10,8,false, _.cloneDeep(rifle), undefined),
//   createCombatant('Light Armorjack Rifleman',40,11,6,8,10,10,10,false, _.cloneDeep(rifle), undefined),
//   30
// )

// results['Heavy Rifle vs Shotgun'] = simulateCombat(
//   createCombatant('Heavy Armorjack Rifleman',40,13,6,6,10,10,8,false, _.cloneDeep(rifle), undefined),
//   createCombatant('Light Armorjack Shotgun',40,11,6,8,10,10,10,false, _.cloneDeep(shotgun), undefined),
//   30
// )

// results['Heavy Rifle vs VHP n Sword'] = simulateCombat(
//   createCombatant('Heavy Armorjack Rifleman',40,13,6,6,10,10,8,false, _.cloneDeep(rifle), undefined),
//   createCombatant('Light Armorjack VHP n Sword',40,11,6,8,10,10,10,false, _.cloneDeep(veryHeavyPistol), _.cloneDeep(sword)),
//   30
// )

// results['Dodge Rifle vs Rifle'] = simulateCombat(
//   createCombatant('Light Armorjack Dodge Rifleman',40,11,6,8,10,10,10,true, _.cloneDeep(rifle), undefined),
//   createCombatant('Light Armorjack Rifleman',40,11,6,8,10,10,10,false, _.cloneDeep(rifle), undefined),
//   30
// )

// results['Dodge Rifle vs Shotgun'] = simulateCombat(
//   createCombatant('Light Armorjack Dodge Rifleman',40,11,6,8,10,10,10,true, _.cloneDeep(rifle), undefined),
//   createCombatant('Light Armorjack Shotgun',40,11,6,8,10,10,10,false, _.cloneDeep(shotgun), undefined),
//   30
// )

// results['Dodge Rifle vs VHP n Sword'] = simulateCombat(
//   createCombatant('Light Armorjack Dodge Rifleman',40,11,6,8,10,10,10,true, _.cloneDeep(rifle), undefined),
//   createCombatant('Light Armorjack VHP n Sword',40,11,6,8,10,10,10,false, _.cloneDeep(veryHeavyPistol), _.cloneDeep(sword)),
//   30
// )

fs.writeFileSync('results.json',JSON.stringify(results,undefined,2))