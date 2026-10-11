export const categories = {profession:'Профессия',biology:'Биология',health:'Здоровье',fact:'Факт',hobby:'Хобби',baggage:'Багаж'};
const card = (category, i, title, tags=[], description=title) => ({id:`${category}_${i}`,category,title,description,tags});
const entries = {
profession:[['Врач','medical'],['Инженер-энергетик','engineering power repair'],['Агроном','agriculture food_production'],['Микробиолог','science biology'],['Логист','logistics'],['Спасатель','survival first_aid'],['Эколог','ecology science'],['Слесарь','craft mechanics'],['Учитель','education'],['Радиотехник','engineering communication'],['Повар','food_production cooking'],['Санитарный инспектор','sanitation'],['Геолог','science navigation'],['Охранник','security'],['Фармацевт','medical chemistry'],['Плотник','craft repair']],
health:[['Крепкое здоровье','robust_health'],['Близорукость; очки при себе',''],['Аллергия на пыль','medical_need'],['Астма; ингалятор при себе','medical_need'],['Ограничена подвижность колена','mobility_limit'],['Хроническая мигрень',''],['Сниженный слух',''],['Сезонная аллергия',''],['Здоров, хорошая выносливость','physical_endurance'],['Восстанавливается после перелома','mobility_limit'],['Нуждается в регулярных лекарствах','medical_need'],['Непереносимость лактозы',''],['Повышенная чувствительность к холоду',''],['Чувствительность к яркому свету',''],['Хорошая физическая форма','robust_health'],['Ослабленный иммунитет','immunocompromised']],
fact:[['Прошёл курсы первой помощи','medical first_aid'],['Жил год в автономной экспедиции','survival'],['Знает три языка','languages'],['Строил систему очистки воды','sanitation engineering'],['Работал на складе продовольствия','logistics'],['Выращивал овощи зимой','agriculture'],['Умеет читать топографические карты','navigation'],['Изучал органическую химию','science chemistry'],['Собирал солнечные панели','power'],['Умеет ремонтировать насосы','mechanics'],['Организовывал эвакуацию','leadership logistics'],['Работал в лаборатории','biology science'],['Служил радистом','communication'],['Умеет шить защитную одежду','craft'],['Обучал детей в полевом лагере','education'],['Составлял санитарные инструкции','sanitation']],
hobby:[['Огородничество','gardening agriculture'],['Ремонт электроники','repair engineering'],['Походы','survival'],['Кулинария','cooking food_production'],['Игра на гитаре','music'],['Столярное дело','craft'],['Любительская астрономия','science'],['Спортивное ориентирование','navigation'],['Радиолюбительство','communication'],['Шитьё','craft'],['Разведение грибов','food_production'],['Первая помощь на соревнованиях','medical first_aid'],['Моделирование механизмов','mechanics'],['Шахматы',''],['Бег на длинные дистанции','physical_endurance'],['Аквариумистика','biology']],
baggage:[['Аптечка на 10 перевязок','medicine'],['Набор ручных инструментов','tool'],['20 пакетов семян','agriculture'],['Портативная солнечная панель','power'],['Радиостанция с аккумулятором','communication'],['10 литров питьевой воды','water'],['Консервы на 7 дней для одного','food'],['Фильтр для воды','sanitation'],['Руководство по медицине','medical'],['Швейный набор','craft'],['Компас и карты района','navigation'],['Запасные детали насосов','mechanics'],['Набор для химических анализов','chemistry science'],['Фонарь и 12 батареек','power'],['Учебники для школы','education'],['Набор садовых инструментов','gardening tool']]
};
export const pools = Object.fromEntries(Object.entries(entries).map(([c,list])=>[c,list.map(([t,tags],i)=>card(c,i,t,tags?tags.split(' '):[]))]));
pools.biology=Array.from({length:16},(_,i)=>card('biology',i,`${i%2?'Женщина':'Мужчина'}, ${[24,31,45,28,52,36,61,23,40,33,48,27,56,39,22,44][i]} лет`,['adult']));
const specs=[
['Второе откровение','after_owner_reveal','reveal_extra_self','Раскрой ещё одну свою закрытую характеристику.'],
['Прямой вопрос','before_reveal','force_reveal_target','Цель случайно раскрывает одну закрытую характеристику.'],
['Неудобный вопрос','pre_vote','force_reveal_target','Цель случайно раскрывает одну закрытую характеристику.'],
['Временная защита','pre_vote','protect_target_from_vote','Цель защищена от чужих голосов на один цикл. Автоголос против себя остаётся.'],
['Решающий аргумент','pre_vote','bonus_vote_target','Один дополнительный голос против допустимой цели.'],
['Оспоренный бюллетень','post_vote','cancel_vote_target','Отмени голос выбранного участника, не раскрывая его выбор.'],
['Последний запас воды','after_elimination','add_resource','Вода +1. Можно использовать после своего выбывания.','water'],
['Резервный генератор','finale','add_resource','Энергия +1 перед проверкой финала.','power']
];
export const specials=Array.from({length:16},(_,i)=>{const [title,timing,type,description,resource]=specs[i%specs.length];return {id:`special_${i}`,title,description,timing,can_use_after_elimination:timing==='after_elimination',effect:{type,...(resource?{resource,delta:1}:{}),...(['force_reveal_target','protect_target_from_vote','bonus_vote_target','cancel_vote_target'].includes(type)?{target:'choose_active_player'}:{})}}});
const tagCheck=(label,any_of)=>({type:'survivor_tag_count',any_of,min_count:1,label});
const orCheck=(label,resource,min_level,capability)=>({type:'bunker_resource_or_capability',resource,min_level,capability,label});
export const catastrophes=[
{id:'winter',title:'Вулканическая зима',category:'natural',description:'Пепел закрыл солнце. Два года холода и неурожаев. Пища и способность работать автономно важнее всего.',hazard_tags:['cold','hunger'],checks:[tagCheck('Есть специалист по производству пищи',['agriculture','food_production']),tagCheck('Есть научные знания или опыт выживания',['science','ecology','survival']),orCheck('Пища ≥ 2 или теплица','food',2,'greenhouse')]},
{id:'blackout',title:'Последний свет',category:'technological',description:'Каскадный отказ энергосети остановил инфраструктуру. Восстановление займёт не менее года.',hazard_tags:['power_failure'],checks:[tagCheck('Есть инженер или специалист по энергии',['engineering','power']),orCheck('Энергия ≥ 3 или резервный генератор','power',3,'backup_power'),tagCheck('Есть медицинская или логистическая компетенция',['medical','logistics'])]},
{id:'epidemic',title:'Неизвестная эпидемия',category:'biological',description:'За пределами убежища распространяется неизвестный патоген. Изоляция необходима на 18 месяцев.',hazard_tags:['infection'],checks:[tagCheck('Есть медицинские или биологические знания',['medical','biology']),orCheck('Медицина ≥ 2 или фильтрация','medicine',2,'filtration'),tagCheck('Есть наука, санитария или логистика',['science','sanitation','logistics'])]}
];
export const profiles=[{id:'station',title:'Подземная станция № 42',description:'Бывший узел гражданской обороны. Изолированные жилые отсеки, водяная скважина и ремонтная мастерская.',initial_resources:{food:3,water:3,air:4,power:2,medicine:2},capabilities:['workshop']},{id:'laboratory',title:'Законсервированная лаборатория',description:'Глубинный исследовательский комплекс с фильтрацией воздуха. Запасы ограничены.',initial_resources:{food:2,water:3,air:4,power:3,medicine:3},capabilities:['filtration']}];
export const bunkerCards=[
['Склад консервов','food',1],['Протечка цистерны','water',-1],['Резерв батарей','power',1],['Аптечный шкаф','medicine',1],['Засор фильтра','air',-1],['Скважина восстановлена','water',1],['Потеря части запасов','food',-1]
].map(([title,resource,delta],i)=>({id:`bunker_${i}`,title,description:`${{food:'Пища',water:'Вода',power:'Энергия',medicine:'Медицина',air:'Воздух'}[resource]} ${delta>0?'+':''}${delta}`,effect_type:'resource',timing:'round_start',duration:'instant',effect:{type:'add_resource',resource,delta}}));
for(const [i,title,capability] of [[7,'Гидропонная теплица','greenhouse'],[8,'Резервный генератор','backup_power'],[9,'Система фильтрации','filtration']]) bunkerCards.push({id:`bunker_${i}`,title,description:`Доступен модуль: ${title.toLowerCase()}.`,effect_type:'module',timing:'round_start',duration:'persistent',effect:{type:'add_capability',capability}});
const nonemptyString=x=>typeof x==='string'&&x.trim().length>0;
function validatePredicate(p){
if(!p||typeof p!=='object'||Array.isArray(p)||!nonemptyString(p.label))throw Error('Некорректное условие или нет пояснения');
switch(p.type){
case 'survivor_tag_count':case 'survivor_tag_max':{
const threshold=p.type==='survivor_tag_count'?p.min_count:p.max_count;
if(!Array.isArray(p.any_of)||!p.any_of.length||p.any_of.some(t=>!nonemptyString(t))||!Number.isInteger(threshold)||threshold<0)throw Error('Некорректная проверка тегов');break;}
case 'bunker_resource_min':case 'bunker_resource_or_capability':
if(!resourceKeys.includes(p.resource)||!Number.isInteger(p.min_level)||p.min_level<0||p.min_level>5)throw Error('Некорректный ресурс или порог');
if(p.type==='bunker_resource_or_capability'&&!nonemptyString(p.capability))throw Error('Нет возможности бункера');break;
case 'bunker_capability_present':if(!nonemptyString(p.capability))throw Error('Нет возможности бункера');break;
default:throw Error('Неизвестная проверка');
}
}
export function validateContent(n){
for(const c of Object.keys(categories)){if(pools[c].length<n||new Set(pools[c].map(x=>x.id)).size!==pools[c].length)throw Error(`Недостаточно уникальных карт: ${c}`);for(const x of pools[c])if(x.category!==c||!x.title||!x.description||!Array.isArray(x.tags))throw Error('Некорректная характеристика');}
if(specials.length<n||new Set(specials.map(x=>x.id)).size!==specials.length||bunkerCards.length<5)throw Error('Недостаточно контента');
for(const x of catastrophes){if(!Array.isArray(x.checks)||x.checks.length!==3)throw Error('Нужно ровно 3 проверки');for(const p of x.checks)validatePredicate(p);}
for(const x of profiles)for(const v of Object.values(x.initial_resources))if(!Number.isInteger(v)||v<0||v>5)throw Error('Некорректный ресурс');
for(const x of specials)if(!['reveal_extra_self','force_reveal_target','protect_target_from_vote','bonus_vote_target','cancel_vote_target','add_resource'].includes(x.effect.type))throw Error('Неизвестный эффект');
}
// Проверяет все типы и окна, используемые этим демонстрационным паком.
const allowedWindows={reveal_extra_self:['after_owner_reveal'],force_reveal_target:['before_reveal','pre_vote'],protect_target_from_vote:['pre_vote'],bonus_vote_target:['pre_vote'],cancel_vote_target:['post_vote'],add_resource:['after_elimination','finale']};
const resourceKeys=['food','water','air','power','medicine'];
export function validatePack(){validateContent(16);const ids=new Set();for(const x of [...Object.values(pools).flat(),...specials,...catastrophes,...profiles,...bunkerCards]){if(!x.id||!x.title||!x.description||ids.has(x.id))throw Error('Пустая карта или повтор ID');ids.add(x.id);}
for(const s of specials){if(!allowedWindows[s.effect.type]?.includes(s.timing)||typeof s.can_use_after_elimination!=='boolean')throw Error('Несовместимый тайминг');if(s.effect.type==='add_resource'&&(!resourceKeys.includes(s.effect.resource)||!Number.isInteger(s.effect.delta)))throw Error('Неверный ресурсный эффект');if(s.effect.target&&s.effect.target!=='choose_active_player')throw Error('Неизвестный выбор цели');}
for(const c of bunkerCards){if(c.timing!=='round_start'||!['instant','round','persistent'].includes(c.duration))throw Error('Неверный тайминг карты бункера');if(c.effect.type==='add_resource'){if(!resourceKeys.includes(c.effect.resource)||!Number.isInteger(c.effect.delta)||c.effect_type!=='resource')throw Error('Неверный ресурс');}else if(c.effect.type!=='add_capability'||!c.effect.capability||c.effect_type!=='module')throw Error('Неизвестный эффект бункера');}
for(const c of catastrophes)if(!['natural','technological','cosmic','biological','social'].includes(c.category)||!Array.isArray(c.hazard_tags))throw Error('Неверная катастрофа');
}
