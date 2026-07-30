package mixpad

import (
	_ "embed"
	"encoding/json"
)

//go:embed scan-entity-map.json
var entityMapRaw []byte

// Full WHATWG entity name sets built from the embedded compact map.
//
//	entityWithSemi: names including the trailing ';' (e.g. "amp;")
//	entityLegacy:   names valid in legacy no-';' form (e.g. "amp")
//
// Matching still requires a ';' in the input, mirroring the JS scanner.
var entityWithSemi = map[string]bool{}
var entityLegacy = map[string]bool{}

func entIsAlnum(c byte) bool {
	return (c >= '0' && c <= '9') || (c >= 'A' && c <= 'Z') || (c >= 'a' && c <= 'z')
}

// parseBucketNames extracts entity-name remainders from a compact bucket string
// (alternating name/replacement pieces).
func parseBucketNames(s string) []string {
	var names []string
	pos := 0
	n := len(s)
	for pos < n {
		nameStart := -1
		for pos < n {
			if entIsAlnum(s[pos]) {
				nameStart = pos
				break
			}
			pos++
		}
		if nameStart == -1 {
			break
		}
		i := nameStart
		for i < n && entIsAlnum(s[i]) {
			i++
		}
		nameEnd := i
		if nameEnd < n && s[nameEnd] == ';' {
			nameEnd++
		}
		names = append(names, s[nameStart:nameEnd])
		valEnd := nameEnd
		for valEnd < n && !entIsAlnum(s[valEnd]) {
			valEnd++
		}
		pos = valEnd
	}
	return names
}

func init() {
	var raw map[string]string
	if err := json.Unmarshal(entityMapRaw, &raw); err != nil {
		return
	}
	add := func(prefix, k string) {
		full := prefix + k
		if len(full) > 0 && full[len(full)-1] == ';' {
			entityWithSemi[full] = true
		} else {
			entityLegacy[full] = true
		}
	}
	for key, val := range raw {
		if len(key) == 1 {
			for _, k := range parseBucketNames(val) {
				add(key, k)
			}
		}
	}
	for key, val := range raw {
		if len(key) == 2 {
			for _, k := range parseBucketNames(val) {
				add(key, k)
			}
		}
	}
}
