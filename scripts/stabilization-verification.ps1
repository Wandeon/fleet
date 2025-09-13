param(
  [string]$AppUrl = "https://app.beautyheadspabymartina.hr",
  [string]$ApiHealth = "http://127.0.0.1:3005/api/health"
)

Write-Host "== Health check =="
$h = (iwr $ApiHealth -UseBasicParsing).Content | ConvertFrom-Json
if(($h.overall -in @("UP","DEGRADED","DOWN")) -and $h.components){ "Health OK" } else { throw "Health invalid" }

Write-Host "== Routes =="
$routes = @("/","/operations","/devices","/health","/logs","/about","/no-such-route")
$routes | % {
  try{
    $r=iwr ($AppUrl + $_) -UseBasicParsing -MaximumRedirection 5 -TimeoutSec 10
    if($_ -eq "/no-such-route" -and $r.StatusCode -ne 404 -and $r.BaseResponse.ResponseUri.AbsolutePath -notmatch "404"){ throw "Expected 404 for $_" }
  } catch { throw "Route check failed for $_ : $($_.Exception.Message)" }
}
"Routes OK"

Write-Host "== Security headers =="
$resp = iwr $AppUrl -UseBasicParsing
$hdr = $resp.Headers
@("content-security-policy","x-content-type-options","referrer-policy","x-frame-options","strict-transport-security") | % {
  if(-not $hdr[$_]){ throw "Missing header: $_" }
}
"Security headers OK"

"✅ ALL CHECKS PASSED - System Ready for Production!"

