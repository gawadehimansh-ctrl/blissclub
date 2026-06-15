import React, { useState, useCallback, useMemo } from 'react'
import { fmtINR, fmtINRCompact, fmtPct, fmtNum } from '../utils/formatters.js'
import { format, parseISO, isWithinInterval } from 'date-fns'

let _XLSX = null
async function loadXLSX() {
  if (_XLSX) return _XLSX
  return new Promise(resolve => {
    if (window.XLSX) { _XLSX = window.XLSX; return resolve(window.XLSX) }
    const s = document.createElement('script')
    s.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js'
    s.onload = () => { _XLSX = window.XLSX; resolve(window.XLSX) }
    document.head.appendChild(s)
  })
}

// ── 892 Liquidation SKU IDs ──────────────────────────────────────────────────
const LIQUIDATION_SKUS = new Set([
  'RE10N408758','RE10N408760','RE16KB409170','RE54ED409175','RE02NS409203','RE02NS409201',
  'RE02NS409220','RE02NS409221','RE02PS409228','RE02RO409235','RE10B409316','RE10B409317',
  'RE13NS409326','RE10B409329','RV30N409553','RW30ES409453','RW04ES409458','RW04ES409460',
  'RW30ED409470','RW04ES409472','RW30ES409532','RV30ED409546','RE10NR409027','RE54ED409069',
  'RE10NS409184','RE54EL409657','RE20ES409659','RE10EC409371','RE10EC409385','RE54ED409178',
  'RE02R409236','RE10B409318','RE10B409332','RE10B409339','RE02NS409347','RE10NS409360',
  'RE10EC409362','RE14NS409404','RE14V409407','RE14V409409','RE14NS409411','RE14NS409412',
  'RE14NS409413','RE14NS409417','RE14NS409421','RE14NS409422','RE10NS409429','RW04RO409484',
  'RW30RO409487','RE16NS409030','RE16NS409049','RE10ED409060','RE10B409561','RE10B409563',
  'RE10B409565','RE10B409569','RE10B409571','RE10B409572','RE10B409576','RE59PO409632',
  'RE59PO409633','RE59PO409634','RE59PO409636','RE59PO409640','RE59PO409643','RE59PO409646',
  'RE59PO409649','RW04EH409506','RE02EC409696','RE10ED409742','RE10EC409745','RV30N409861',
  'RE59PO409888','RE10NS409354','RE10NS409625','RE10EL409786','RE10V409787','RV30V409856',
  'RV30V409788','RV30V409789','RV30V409791','RW30N409895','RE02NS409399','RE10B409594',
  'RE10B409608','RE13PS409735','RE10NS409729','RE14NS409866','RW30V409898','RW04V409899',
  'RW30V409903','RW30V409905','RW04V409907','RE57NS409738','RE10NS409708','RE14NS409868',
  'RE14NS409869','RE16NS409994','RE13NS409995','RE14NS409996','RE13V409997','RE14ES409998',
  'RE10MT410005','RE10V410019','RE13R410043','RE20NS409985','RE14NS409986','RE14NS409988',
  'RE10B409588','RE10B409589','RE10B409599','RE10NS409714','RE10NS409716','RE10NS409727',
  'RE20NS409748','RE10NS409754','RE10NS409760','RE10NS409766','RE10NS409767','RE10KB409777',
  'RE16NS409870','RE57NS409878','RE10ED409965','RE10NS410010','RE02NP410051','RE10NP410054',
  'RE10NP410055','RE10NP410056','RE10NS410061','RE10NS410064','RE02ED410068','RE04ED410069',
  'RE02ED410071','RE16NS410072','RE10B410181','RE10B410184','RE10EC409285','RE02ED410195',
  'RE10NS410245','RE10NS410246','RE10NS410260','RE10NS410262','RE02ED410196','RE10B410208',
  'RE10B410209','RE10B410216','RE20B410233','RE20V410241','RE57EC409275','RE02ED409248',
  'RE02ED409267','RE02ED409272','RE10SD410285','RE10NS410286','RE02NS410287','RE10NS410291',
  'RW04EJ410297','RW04EJ410299','RW30EJ410301','RE13ED410309','RE13NS410314','RE13ES410318',
  'RW04ED410328','RW30ED410329','RW30ED410336','RW04ED410346','RW30ED410349','RW30ES410357',
  'RW30V410663','RW04EH410380','RE30ES410388','RE02NS410512','RE10NS410636','RE10NS409615',
  'RE20NS409616','RE10ED409620','RE10V410275','RE10V410276','RE10SD410278','RE10SD410284',
  'RV04EH410435','RV30V410488','RE10N410642','RE10N410643','RE02ED409252','RE02ED409261',
  'RE10ED410660','RV04V410540','RE16NS410680','RE16NS410691','RE16NS410692','RE10MT410694',
  'RE10EJ410710','RE20NS410768','RE10B409592','RE10B409611','RE10NS410543','RE54C410731',
  'RE16NS410717','RE10NS410724','RE16NS410727','RE10EC410729','RE16KB410847','RE10B410890',
  'RE10B410899','RE10B410904','RE10B410905','RE10B410935','RE10NS410952','RE57B410990',
  'RE10B410993','RE16NS410584','RE10NS410633','RE10NS410967','RV30N410975','RE10NS410981',
  'RE02NS410714','RE10B411132','RE10B411134','RE10B411137','RE16KB411107','RE10MS411068',
  'RE02HB411097','RE10MP411105','RE14HP411377','RE14ES411385','RE10NS411404','RE10N411413',
  'RE10NS411414','RE10EN411419','RE10B410892','RE10B410893','RE10B410922','RE10B410878',
  'RE10B410903','RE10B410931','RE10B410873','RE10KB411109','RE10BH411113','RE20EN411115',
  'RW71SB411661','RE20B411475','RE20B411482','RE10B411490','RE10B411492','RW01N411125',
  'RW62SB411669','RW04ED411515','RW04ED411516','RW30EH411526','RW30ED411545','RW04NS411555',
  'RW04NS411557','RW04NS411561','RV04EH411649','RE10NS411677','RE02RO411680','RE10EF410732',
  'RE10EF410735','RE10EF410736','RE10EN411794','RE20ES411797','RE10NS411425','RE57HV411703',
  'RE57HV411705','RE10MS411867','RE10EF411730','RE54EC411752','RE54ED411756','RE10ED411758',
  'RE54EJ411761','RE10EJ411768','RE54ED411886','RW19V411913','RE02MT411013','RE02MD411029',
  'RE10B412017','RE10ED412031','RE10B412037','RE20ED411445','RE10EF412049','RE54NS412087',
  'RE54NS412102','RE10PC412088','RE10MS412253','RE59PO412233','RE59PO412234','RE59PO412241',
  'RE71C412242','RE02B412019','RE10EJ411754','RE54EJ411772','RE10NS411788','RE54EJ411893',
  'RE10N411925','RE10C411927','RE10N411934','RE10NS411939','RE54KB411939','RE54N411953',
  'RE54N411957','RE54EH411967','RE54EJ411972','RE54EJ411975','RE54ED411977','RE10ED411988',
  'RE54EJ411989','RE54EJ411993','RW10KB411022','RE10KB412120','RE10ME412332','RE10KB411790',
  'RE04NS412011','RE10MS412125','RE02MT412152','RE02ED412245','RE10MS412250','RW30ES412300',
  'RW30ES412301','RW30ES412302','RW30ES412304','RW04EJ412316','RE10PO412436','RE13ED412701',
  'RE02ED412726','RE02RO412158','RE02NS412382','RW30C412317','RW71C412321','RE02PS411800',
  'RE10ED413080','RE10N413203','RE02SD412799','RE02V412802','RE10V412300','RE10EF411726',
  'RE02NS408967','RE10KB409169','RE54EJ409173','RE10PS409223','RE20EC408783','RE02NS408841',
  'RE02EL408923','RE54EJ409171','RE10ED408918','RE10NS408956','RE20NS408942','RE20NS408945',
  'RE04NS408857','RE04NS408856','RE04NS408858','RW30NS406611','RV30EH406272','RE10ED409020',
  'RV30V407918','RE02EJ408969','RE10PS406700','RE10PS406701','RE02NS405091','RE02CS300666',
  'RE14V403560','RW30ED406143','RE10N406549','RTW06ED274832','RE02NS406763','RM02V038',
  'RE57MS404254','RE70MS408482','RM02N020','RM02N034','RE10NS406584','RE04CS406627',
  'RM02N0210','RE02NS406752','RM02V120','RM01VR233','RE02NS403628','RE70V404258',
  'RE54EL403971','RE10NS406267','RE63NS279571','RE54N406904','RM20PCR263','RE54EC406743',
  'RE02NS406958','RE10NS406249','RE57MS404253','RE56B278842','RE02NS403604','RE14NS407121',
  'RE10NS406929','RE70NS405360','RE20NS407120','RE20NS404856','RE10NS405345','RE20EJ404920',
  'RE14B407226','RW04V407011','RE02B407025','RE20ED404688','RE10NS406799','RE10EJ406891',
  'RE54CS406835','RE02NS406960','RV30EH403179','RE20B405185','RE10NS402843','RE02PS404810',
  'RE54NS406777','RE10NS406841','VIE10N400376','RE14NS404994','RE14NS405000','RE10NS404772',
  'RE02PS402314','RE20B405202','RE14NS404951','RE10B406831','RV04SD403284','RE10NS405344',
  'RE14ED408751','RE10CS402817','RE14NS404999','RE20NS404854','RE10V406347','RE57B402835',
  'RE57B402837','RE54NS404599','RE10CS406937','RE10CS406938','RE54C402701','RE20NS406732',
  'RE14V408426','RE04EC405284','RE16EC403940','RE20NS406597','RE04NS403948','RE14NS406343',
  'RE10KB407267','RE10NS406895','RE10NS406786','RE51ED404924','RE58NS276482','RW30ED406473',
  'RE10N406739','RE02NS403013','RE54N275217','RE11N25548','RE04EC270353','RE02EC403617',
  'RE20B405188','RE20B405189','RE16B276015','RM02V403699','RE14MT405426','RE14MT405427',
  'RE53ED403534','RE10NS403442','RE51NS277104','RE54EL406906','RE14ED408757','RE54NS275840',
  'RE10AA407298','RE20V406258','RE02PS404812','RE10EC407111','RE58NS276458','RE54B402692',
  'RE54C2742180','RE02R402770','RE63MS279639','RW30V406462','RE51ED404926','RE10NS404741',
  'RE20ED404698','RE04NS273047','RE13B405050','RW06ED402745','RE51NC273116','RE54EC406918',
  'RE02R402767','RE14ED402604','RE20NS406567','RE10KB407289','RE10KB407290','RM02PC403861',
  'RE02EJ275274','RE34NS300303','RE54N271306','RE13NS402396','RE10KB407291','RE54EJ404586',
  'RE54EL402866','RE70EC277889','RE54C401387','RM02N404305','RE10NS406984','RE57N403364',
  'RE20ED406332','RE10EL408671','RE10KB407277','RE02EJ276159','RE04B0037','RW06ED402672',
  'RE02NS402105','RE04NS406626','RM05V403701','RM02V404646','RM05V403703','RE51ED276983',
  'RE13ED405258','RM02PC404651','RE59HB276363','RE56ES269419','RE10EC406975','RE16EJ403931',
  'RE13PC401290','RE46NS277744','RE51NS273015','RE10ED404394','RE54N402533','RE14RO403393',
  'RM01V404409','RE20R404687','RE16EJ403937','RE62SB403468','RE10NS278667','RE16NS300913',
  'RE51ED274505','RE02B402281','RE13PC401295','RE54ED406921','RE32NS274592','RE03ED404475',
  'RE10NS408627','RE02ED276160','RE54EL403970','RW30EH406409','RW30ES406519','RE54V406952',
  'RE10NS278672','RE34EC276185','RE10NS278665','RE02ME407303','RE14EJ403770','RE54N406778',
  'RE54CS406776','RE14R402610','RE14RO402592','RE51NS276434','RE13NS408793','RE13NS402401',
  'RW06ED405740','OP00350','RE54EJ402864','RBE70NS300101','RE56B278841','RE70ED277886',
  'RW06EH405810','RE58EC26130','RE62SB403471','RE54B402678','RE02ED406295','RE14RO407311',
  'RE14RO407314','RE13R401275','RBE14NS278315','RE28NS404352','RE14RO407503','RE54ED403481',
  'RW06PV405709','RE02EC406301','RV04ED405545','RW04ED406036','RV30V405588','RBE04EJ278340',
  'RE46EC277799','RW04N405837','RE03EJ278341','RBE16NS400236','RTW06ED275736','RE62SB403483',
  'RW06EL405809','RV30ES405340','RW30A405619','RBE13V2300497','RE14R401279','RW06ES405720',
  'RW06ED405723','RBE14NS400259','RBE04MS4300690','RW04ES406039','RE16CS276222','RW06ED405811',
  'RW30EH404725','RE51NS276435','RE04MS300015','RB10NS402143','RE03EJ278343','RW04CS405900',
  'RE58CS402979','RBE57RO4278223','RM02CR163','RV30N405610','RBE57CS300295','RW30V405712',
  'RE54V275400','RTW02ES402380','VW30N400795','RE51ES272878','RTW01ES4021103','VCW30V278659',
  'RTW13ED278475','RW30ES406436','VW03ED401064','RW03ED402625','RTW30EH404205','RBE14NS278168',
  'RTW03NL274666','RT30PC277442','RSE07PC900068','RBE14NS278165','VIE20V276803','RW30EH407451',
  'RE54EC276836','RE58MT276198','RE54ED276897','RW04EH407793','RE10C406950','RW04ES407779',
  'RW04ED407782','RW30EL407778','RW30EH407762','RW30EL407777','RV30EH407828','RV04EH407827',
  'RE13B407165','RE13B407171','RE13B407172','RE14B407181','RE10B406334','RE10B406854',
  'RE20B406858','RE02B406985','RE02B406986','RE02B406989','RE14B406992','RE04B406648',
  'RE04B406650','RE04B406654','RE04B406658','RE04B406659','RE04B406661','RE10B407067',
  'RE10B407068','RE10B407069','RE54PB01550','RE14B406225','RE14B406226','RE10B407070',
  'RE02B405931','RE02B405916','RE02B405907','RE02B405962','RE02B405961','RE02B405965',
  'RE02B405933','RE02B405934','RE20EC408785','RE20NS407473','RE20MT407483','RE13MT407493',
  'RE14V407510','RE13V407509','RE14MT407524','RE13MT407527','RE14MT407529','RE02MT407544',
  'RE02KB407546','RE02BH407558','RTW26NL2709350','RE20B407591','RE20B407597','RE10B407601',
  'RE10B407626','RE10B407627','RE04KB407641','RW30N407716','RW30N407714','RV30SD407740',
  'RE02MP407684','RE02NS407688','RE02NS407691','RW30RO407765','RW04C407720','RW04RO407771',
  'RV30R407871','RV04EH407832','RV04EF407776','RV30R407864','RV30N407852','RV30V407883',
  'RV30N407855','RV30V407884','RW04N407715','RW30ED407739','RE10EN407820','RW04N407711',
  'RW30V407731','RW19ES407771','RW04N408117','RW04V408107','RW19HB407997','RE10B408062',
  'RE10NS408045','RE10NS408051','RE10NS408055','RE02EC407978','RV30N407984','RW30RO408233',
  'RV04ED407742','RW30V408321','RE20NS408205','RE14CS408540','RW30V408314','RE20B408123',
  'RE20B408171','RE20RO408214','RE20EJ408215','RE20RO408219','RE20NS408228','RW30A408337',
  'RE14B408279','RE14B408280','RE14B408281','RE14B408283','RM30N408461','RE20A408421',
  'RE10B408365','RE10B408370','RE10EF408381','RE10EF408384','RE10EF408387','RTW27ED275029',
  'RE10NS402815','RTW03E2274831','RE14NS408417','RE14NS408418','RE57NS408428','RE03B408442',
  'RE03B408444','RE03B408450','RE10N408477','RE02NS408480','RE14NS408413','RE14NS408420',
  'RE02ED408497','RE10B408528','RM30V408488','RE10NS408510','RE10NS408513','RE10NS408515',
  'RE14NS408537','RE54EJ408544','RE54EJ408546','RE54ED408551','RE10C408564','RW04HV408573',
  'RW04HV408576','RW30HV408577','RE13NS408592','RE13NS408609','RE14B2773480','RE14B2773880',
  'RE14B2772350','RE14B2773810','RE14B4045230','RE14B4052440','RE14B4071970','RE14B4072230',
  'RE14B4072240','RE13B4071380','RE13B4071390','RE13B4072380','RE14B4072280','RE13B4071620',
  'RE13B4071640','RE14B4071740','RE14B4071750','RE14B4071760','RE13B4071910','RE14B4072290',
  'RE14B4072300','RE14B4072040','RE14B4072060','RE14B4072020','RE13B4071320','RE13B4071340',
  'RE13B4071290','RE13B4071300','RE13B4071310','RE20B4070980','RE20B4081410','RE14B4082870',
  'RE20B4081670','RE20B4081690','RE20B4082010','RE20B4081350','RE20B4081990','RE20B4081610',
  'RE54V408621','RE10EN408645','RE10EN408646','RE10NS408650','RE10BH408664','RE59MS408680',
  'RE59MS408685','RE10NS408690','RE10EL408694','RE10EC408694','RE10EC408695','RE10NS402362',
  'RE54N408721','RE10N408742','RE10EL408748','RE10B402788','RE14B407136','RE14B407198',
  'RE13B407260','RE05EJ2277825','RE14B407192','RE14B407204','RE16EJ403929','RE54EC402265',
  'RE10NS408669','RE14NS408773','RE02NS408797','RE02RO408813','RE02R408814','RE02RO408815',
  'RE10NS408817','RE10NP408820','RE10NP408824','RE10NP408826','RE02ES408832','RE02ES408833',
  'RE10EJ408838','RE10EJ408924','RE10NP408952','RE10B408886','RE10B408887','RE10B408888',
  'RE10B408890','RE10B408891','RE20B408892','RE20B408894','RE10B408862','RE10B408863',
  'RE10B408869','RE10B408871','RE10B408881','RE10B408884','RE10B408885','RE10B408896',
  'RE10B408903','RE10B408904','RE14B4089750','RE14B4089760','RE20B4089790','RE10B4089800',
  'RE10B4089820','RE10B4089990','RE10B4090000','RE10B4090020','RE10B4090070','RE10B4090080',
  'RE10B4090090','RE70PO0106','RE02EL406291','RE02CS402903','RE04B413450','RE56BB413623',
  'RS01RO411155','RS01RO411160','RS01RO411163','RS01N411172','RS01V411200','RS01ED411220',
  'RS01ES411326','RS01ES411331','RS01V411350','RS01RO411153',
])

const LIQUIDATION_CUTOFF = '2026-05-23' // pre = up to this date, post = after

function num(v) { return parseFloat(String(v).replace(/[₹,]/g,'')) || 0 }

// Parse Shopify orders export — detect SKU col + revenue col
function parseShopifyOrders(ws, XLSX) {
  const rows = XLSX.utils.sheet_to_json(ws, { defval: null })
  if (!rows.length) return []
  const cols = Object.keys(rows[0])
  const skuCol   = cols.find(c => /sku/i.test(c))
  const revCol   = cols.find(c => /subtotal|net.sales|total.price|net_sales/i.test(c)) || cols.find(c => /revenue|sales/i.test(c))
  const dateCol  = cols.find(c => /date|created|day/i.test(c))
  if (!skuCol || !dateCol) return []
  return rows.map(r => ({
    date: String(r[dateCol] || '').slice(0, 10),
    sku: String(r[skuCol] || '').trim().toUpperCase(),
    revenue: num(r[revCol] || 0),
  })).filter(r => r.date && r.sku)
}

function roasCol(v) {
  if (v >= 15) return 'var(--green)'
  if (v >= 10) return 'var(--amber)'
  return 'var(--red)'
}

const TH = { padding:'7px 12px', fontSize:10, fontWeight:700, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'0.05em', background:'var(--bg3)', whiteSpace:'nowrap' }
const TD = { padding:'7px 12px', borderBottom:'0.5px solid var(--border)', fontSize:12 }

export default function LiquidationTracker() {
  const [rows, setRows]     = useState(null)
  const [file, setFile]     = useState('')
  const [loading, setLoading] = useState(false)
  const [dateFrom, setDateFrom] = useState('2026-01-01')
  const [dateTo, setDateTo]     = useState(new Date().toISOString().slice(0,10))
  const [compareFrom, setCompareFrom] = useState('')
  const [compareTo, setCompareTo]     = useState('')
  const [view, setView] = useState('overview') // overview | daily | sku

  const handleFile = useCallback(async f => {
    if (!f) return
    setLoading(true)
    setFile(f.name)
    const XLSX = await loadXLSX()
    const reader = new FileReader()
    reader.onload = e => {
      try {
        const wb = XLSX.read(e.target.result, { type: 'binary' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        setRows(parseShopifyOrders(ws, XLSX))
      } catch(err) { console.error(err) }
      setLoading(false)
    }
    reader.readAsBinaryString(f)
  }, [])

  // Filter + aggregate
  const filtered = useMemo(() => {
    if (!rows) return []
    return rows.filter(r => r.date >= dateFrom && r.date <= dateTo)
  }, [rows, dateFrom, dateTo])

  const compared = useMemo(() => {
    if (!rows || !compareFrom || !compareTo) return []
    return rows.filter(r => r.date >= compareFrom && r.date <= compareTo)
  }, [rows, compareFrom, compareTo])

  function calcMetrics(r) {
    const totalRev  = r.reduce((s,x) => s + x.revenue, 0)
    const liqRows   = r.filter(x => LIQUIDATION_SKUS.has(x.sku))
    const liqRev    = liqRows.reduce((s,x) => s + x.revenue, 0)
    const liqPct    = totalRev > 0 ? liqRev / totalRev : 0
    return { totalRev, liqRev, liqPct }
  }

  const curr = useMemo(() => calcMetrics(filtered), [filtered])
  const comp = useMemo(() => calcMetrics(compared), [compared])

  // Daily breakdown
  const dailyData = useMemo(() => {
    const map = {}
    filtered.forEach(r => {
      if (!map[r.date]) map[r.date] = { date: r.date, totalRev: 0, liqRev: 0 }
      map[r.date].totalRev += r.revenue
      if (LIQUIDATION_SKUS.has(r.sku)) map[r.date].liqRev += r.revenue
    })
    return Object.values(map).sort((a,b) => a.date.localeCompare(b.date)).map(d => ({
      ...d, liqPct: d.totalRev > 0 ? d.liqRev / d.totalRev : 0,
      isPre: d.date <= LIQUIDATION_CUTOFF,
    }))
  }, [filtered])

  // Top liquidation SKUs
  const topSkus = useMemo(() => {
    const map = {}
    filtered.filter(r => LIQUIDATION_SKUS.has(r.sku)).forEach(r => {
      if (!map[r.sku]) map[r.sku] = { sku: r.sku, revenue: 0 }
      map[r.sku].revenue += r.revenue
    })
    return Object.values(map).sort((a,b) => b.revenue - a.revenue).slice(0, 50)
  }, [filtered])

  const tabBtn = active => ({
    padding:'6px 14px', fontSize:12, fontWeight:600, borderRadius:8, cursor:'pointer',
    background: active ? 'var(--blue)' : 'var(--bg3)',
    border: '0.5px solid ' + (active ? 'var(--blue)' : 'var(--border2)'),
    color: active ? '#fff' : 'var(--text2)',
  })

  return (
    <div style={{padding:'24px 28px'}}>
      {/* Header */}
      <div style={{marginBottom:16}}>
        <h1 style={{fontSize:22, fontWeight:700, marginBottom:4}}>Liquidation Tracker</h1>
        <div style={{fontSize:12, color:'var(--text3)'}}>
          892 price-changed SKUs · Pre-liquidation (Jan–23 May) vs Post-liquidation (24 May+)
          {file && <span style={{marginLeft:8, color:'var(--text2)'}}>· {file}</span>}
        </div>
      </div>

      {/* Upload */}
      {!rows && !loading && (
        <label style={{display:'block', border:'1.5px dashed var(--border2)', borderRadius:12, padding:'40px 24px', textAlign:'center', cursor:'pointer', background:'var(--bg2)', marginBottom:20}}>
          <input type="file" accept=".xlsx,.xls,.csv" style={{display:'none'}} onChange={e=>handleFile(e.target.files?.[0])} />
          <div style={{fontSize:28, marginBottom:8}}>📦</div>
          <div style={{fontSize:13, fontWeight:600, marginBottom:4}}>Upload Shopify orders export</div>
          <div style={{fontSize:11, color:'var(--text3)'}}>Needs Date, SKU, and Revenue/Net Sales columns</div>
          <div style={{fontSize:11, color:'var(--blue)', marginTop:6}}>or click to browse</div>
        </label>
      )}
      {loading && <div style={{textAlign:'center', padding:40, color:'var(--text3)'}}>Parsing file…</div>}

      {rows && (
        <>
          {/* Date filters */}
          <div style={{display:'flex', gap:12, marginBottom:20, flexWrap:'wrap', alignItems:'flex-end'}}>
            <div>
              <div style={{fontSize:11, color:'var(--text3)', marginBottom:4}}>From</div>
              <input type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)}
                style={{padding:'6px 10px', borderRadius:6, background:'var(--bg3)', border:'0.5px solid var(--border2)', color:'var(--text)', fontSize:12}}/>
            </div>
            <div>
              <div style={{fontSize:11, color:'var(--text3)', marginBottom:4}}>To</div>
              <input type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)}
                style={{padding:'6px 10px', borderRadius:6, background:'var(--bg3)', border:'0.5px solid var(--border2)', color:'var(--text)', fontSize:12}}/>
            </div>
            <div style={{width:1, background:'var(--border)', alignSelf:'stretch'}}/>
            <div style={{fontSize:11, color:'var(--text3)', alignSelf:'center'}}>Compare</div>
            <div>
              <div style={{fontSize:11, color:'var(--text3)', marginBottom:4}}>From</div>
              <input type="date" value={compareFrom} onChange={e=>setCompareFrom(e.target.value)}
                style={{padding:'6px 10px', borderRadius:6, background:'var(--bg3)', border:'0.5px solid var(--border2)', color:'var(--text)', fontSize:12}}/>
            </div>
            <div>
              <div style={{fontSize:11, color:'var(--text3)', marginBottom:4}}>To</div>
              <input type="date" value={compareTo} onChange={e=>setCompareTo(e.target.value)}
                style={{padding:'6px 10px', borderRadius:6, background:'var(--bg3)', border:'0.5px solid var(--border2)', color:'var(--text)', fontSize:12}}/>
            </div>
            <label style={{fontSize:11, padding:'6px 12px', borderRadius:6, background:'var(--bg3)', border:'0.5px solid var(--border2)', color:'var(--text2)', cursor:'pointer', alignSelf:'flex-end'}}>
              Replace file <input type="file" accept=".xlsx,.xls,.csv" style={{display:'none'}} onChange={e=>handleFile(e.target.files?.[0])} />
            </label>
          </div>

          {/* Quick preset buttons */}
          <div style={{display:'flex', gap:6, marginBottom:20, flexWrap:'wrap'}}>
            {[
              { label:'Pre-liq', f:'2026-01-01', t:'2026-05-23' },
              { label:'Post-liq', f:'2026-05-24', t:new Date().toISOString().slice(0,10) },
              { label:'Jan 26', f:'2026-01-01', t:'2026-01-31' },
              { label:'May 26', f:'2026-05-01', t:'2026-05-31' },
              { label:'Jun 26', f:'2026-06-01', t:new Date().toISOString().slice(0,10) },
            ].map(p => (
              <button key={p.label} onClick={()=>{ setDateFrom(p.f); setDateTo(p.t) }}
                style={{padding:'4px 10px', fontSize:11, borderRadius:6, cursor:'pointer', background:'var(--bg3)', border:'0.5px solid var(--border2)', color:'var(--text2)'}}>
                {p.label}
              </button>
            ))}
          </div>

          {/* KPI Cards */}
          <div style={{display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, marginBottom:20}}>
            {[
              { label:'Total Store Revenue', val: fmtINR(curr.totalRev), comp: compared.length ? fmtINR(comp.totalRev) : null, color:'var(--text)' },
              { label:'892 SKU Revenue', val: fmtINR(curr.liqRev), comp: compared.length ? fmtINR(comp.liqRev) : null, color:'var(--amber)' },
              { label:'Liquidation SKU %', val: (curr.liqPct*100).toFixed(1)+'%', comp: compared.length ? (comp.liqPct*100).toFixed(1)+'%' : null, color: roasCol(curr.liqPct*100) },
            ].map(c => (
              <div key={c.label} style={{background:'var(--bg2)', border:'0.5px solid var(--border)', borderRadius:10, padding:'14px 16px'}}>
                <div style={{fontSize:10, color:'var(--text3)', marginBottom:6, textTransform:'uppercase', letterSpacing:'0.05em'}}>{c.label}</div>
                <div style={{fontSize:22, fontWeight:700, color:c.color, marginBottom: c.comp ? 6 : 0}}>{c.val}</div>
                {c.comp && (
                  <div style={{fontSize:11, color:'var(--text3)'}}>Compare period: <span style={{color:'var(--text2)', fontWeight:600}}>{c.comp}</span></div>
                )}
              </div>
            ))}
          </div>

          {/* Tabs */}
          <div style={{display:'flex', gap:6, marginBottom:20}}>
            <button style={tabBtn(view==='overview')} onClick={()=>setView('overview')}>Overview</button>
            <button style={tabBtn(view==='daily')} onClick={()=>setView('daily')}>Daily Breakdown</button>
            <button style={tabBtn(view==='sku')} onClick={()=>setView('sku')}>Top SKUs</button>
          </div>

          {/* OVERVIEW */}
          {view === 'overview' && (
            <div>
              <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:16}}>
                {/* Pre-liq summary */}
                {['pre','post'].map(period => {
                  const isPre = period === 'pre'
                  const pRows = filtered.filter(r => isPre ? r.date <= LIQUIDATION_CUTOFF : r.date > LIQUIDATION_CUTOFF)
                  const m = calcMetrics(pRows)
                  return (
                    <div key={period} style={{background:'var(--bg2)', border:'0.5px solid ' + (isPre ? 'var(--border)' : 'rgba(29,185,84,0.3)'), borderRadius:10, padding:16}}>
                      <div style={{fontSize:13, fontWeight:700, marginBottom:12, color: isPre ? 'var(--text2)' : 'var(--green)'}}>
                        {isPre ? '◀ Pre-Liquidation (Jan–23 May)' : '▶ Post-Liquidation (24 May+)'}
                      </div>
                      <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10}}>
                        <div><div style={{fontSize:10, color:'var(--text3)', marginBottom:3}}>Store Rev</div><div style={{fontSize:14, fontWeight:700}}>{fmtINRCompact(m.totalRev)}</div></div>
                        <div><div style={{fontSize:10, color:'var(--text3)', marginBottom:3}}>Liq Rev</div><div style={{fontSize:14, fontWeight:700, color:'var(--amber)'}}>{fmtINRCompact(m.liqRev)}</div></div>
                        <div><div style={{fontSize:10, color:'var(--text3)', marginBottom:3}}>Liq %</div><div style={{fontSize:16, fontWeight:700, color: m.liqPct > 0.15 ? 'var(--red)' : 'var(--green)'}}>{(m.liqPct*100).toFixed(1)}%</div></div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* DAILY BREAKDOWN */}
          {view === 'daily' && (
            <div style={{overflowX:'auto', borderRadius:8, border:'0.5px solid var(--border)'}}>
              <table style={{width:'100%', borderCollapse:'collapse', fontSize:12}}>
                <thead>
                  <tr>
                    {['Date','Period','Total Store Rev','892 SKU Rev','Liq %'].map((h,i) => (
                      <th key={h} style={{...TH, textAlign: i<2 ? 'left' : 'right'}}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {dailyData.map(d => (
                    <tr key={d.date}
                      onMouseEnter={e=>e.currentTarget.style.background='var(--bg3)'}
                      onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                      <td style={{...TD}}>{d.date}</td>
                      <td style={{...TD}}>
                        <span style={{fontSize:10, padding:'2px 6px', borderRadius:4, fontWeight:600,
                          background: d.isPre ? 'rgba(255,255,255,0.06)' : 'rgba(29,185,84,0.12)',
                          color: d.isPre ? 'var(--text3)' : 'var(--green)'}}>
                          {d.isPre ? 'Pre' : 'Post'}
                        </span>
                      </td>
                      <td style={{...TD, textAlign:'right'}}>{fmtINR(d.totalRev)}</td>
                      <td style={{...TD, textAlign:'right', color:'var(--amber)'}}>{fmtINR(d.liqRev)}</td>
                      <td style={{...TD, textAlign:'right', fontWeight:600, color: d.liqPct > 0.15 ? 'var(--red)' : d.liqPct > 0.12 ? 'var(--amber)' : 'var(--green)'}}>
                        {(d.liqPct*100).toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* TOP SKUs */}
          {view === 'sku' && (
            <div style={{overflowX:'auto', borderRadius:8, border:'0.5px solid var(--border)'}}>
              <table style={{width:'100%', borderCollapse:'collapse', fontSize:12}}>
                <thead>
                  <tr>
                    {['#','SKU ID','Revenue','% of Liq Total'].map((h,i) => (
                      <th key={h} style={{...TH, textAlign: i<2 ? 'left' : 'right'}}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {topSkus.map((s,i) => (
                    <tr key={s.sku}
                      onMouseEnter={e=>e.currentTarget.style.background='var(--bg3)'}
                      onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                      <td style={{...TD, color:'var(--text3)'}}>{i+1}</td>
                      <td style={{...TD, fontWeight:600, color:'var(--amber)'}}>{s.sku}</td>
                      <td style={{...TD, textAlign:'right'}}>{fmtINR(s.revenue)}</td>
                      <td style={{...TD, textAlign:'right', color:'var(--text2)'}}>{curr.liqRev > 0 ? ((s.revenue/curr.liqRev)*100).toFixed(1)+'%' : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}
