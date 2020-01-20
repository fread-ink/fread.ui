#!/usr/bin/env ruby

# Show total memory usage for fread.ui
# Note: Ensure no other WebKit-based apps are running
#
# Prerequisites:
#
#   sudo apt install ruby smem
#

def humanize(n, g=nil)
  if n > 1024
     return "%0.2f MB" % (n.to_f / 1024)
  end
  return "%d kB" % n
end

def getmem(name, header=false, rest=false)
  out=`smem -P #{name} | grep -v python | grep -v smem`

  lines = out.split(/\n/)
  uss=0
  pss=0
  rss=0
  first=true

  lines.each do |line|
    if first
      first = false
      if header
        puts line
      end
      next
    end
    if rest
      puts line
    end
    fields = line.split(/\s+/)

    uss += fields[fields.length-3].to_i
    pss += fields[fields.length-2].to_i
    rss += fields[fields.length-1].to_i
  end
  return uss, pss, rss
end

puts ""

uss, pss, rss = getmem("WebKit", true, true)
uss2, pss2, rss2 = getmem("fread", false, true)

puts ""

uss = humanize(uss + uss2)
pss = humanize(pss + pss2)
rss = humanize(rss + rss2)

puts "Unshared: %10s" % uss
puts "PSS:      %10s" % pss
puts "Resident: %10s" % rss

puts ""

