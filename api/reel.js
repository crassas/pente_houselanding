// Keep previously published video links working with the uploaded MP4 files.
const videos=new Set(['CS0EoMPIq-i', 'CSKPYzJILXw', 'CTPyHeNokiS', 'CViDkCvoowF', 'CYeKZgDMO_m', 'CaqKp2voJmB', 'CmgYhhSDf8e', 'CpaSldAD3gy', 'Cvr77PLo5kW_01', 'Cvr77PLo5kW_02', 'DC_hZmyIBgN', 'DON8B7MDHFr', 'DOQ8-6SCMwX', 'DOQ9FCxiOKR', 'DOQ9OXLiKMI', 'Da_O2EkKX9k', 'Da_OkRyq9kg', 'Da_PDJnqJ7p', 'DdrkGS0xEf5']);
export default function handler(req,res){
  if(req.method && !["GET","HEAD"].includes(req.method)){
    res.setHeader("Allow","GET, HEAD");
    return res.status(405).json({error:"method_not_allowed"});
  }
  const code=String(req.query?.code||"");
  if(!videos.has(code))return res.status(404).json({error:"video_unavailable"});
  res.setHeader("Cache-Control","public, max-age=3600");
  return res.redirect(307,"/media/reels/"+code+".mp4");
}
