package domain

import (
	"strings"
	"testing"
	"time"
)

func TestRaidMapAllLandmarksAlwaysReachable(t *testing.T) {
	for seed := int64(1); seed <= 1000; seed++ {
		zones := buildServerRaidZones(seed)
		if len(zones) != len(RaidZoneTemplates) {
			t.Fatalf("seed %d: expected %d zones, got %d", seed, len(RaidZoneTemplates), len(zones))
		}
		for zIdx, tmpl := range RaidZoneTemplates {
			z := zones[zIdx]
			// 1. Verify no wall spawns adjacent to any fixed landmark
			for _, fix := range tmpl.Fixed {
				for _, dir := range [][2]int32{{1, 0}, {-1, 0}, {0, 1}, {0, -1}} {
					nx, ny := fix.X+dir[0], fix.Y+dir[1]
					if nx < 0 || nx >= z.Width || ny < 0 || ny >= z.Height {
						continue
					}
					if z.Tiles[int(ny*z.Width+nx)].Kind == "wall" {
						t.Fatalf("seed %d zone %d: wall at (%d,%d) blocks neighbor of landmark (%d,%d) kind=%s",
							seed, z.ID, nx, ny, fix.X, fix.Y, fix.Kind)
					}
				}
			}

			// 2. BFS from entry anchor must reach every fixed landmark on foot
			anchorX, anchorY := tmpl.Fixed[0].X, tmpl.Fixed[0].Y
			for _, fix := range tmpl.Fixed {
				if fix.Kind == "spawn" {
					anchorX, anchorY = fix.X, fix.Y
					break
				}
			}
			visited := make([]bool, int(z.Width*z.Height))
			startIdx := int(anchorY*z.Width + anchorX)
			visited[startIdx] = true
			queue := []int{startIdx}
			for head := 0; head < len(queue); head++ {
				cur := queue[head]
				cx := int32(cur) % z.Width
				cy := int32(cur) / z.Width
				for _, dir := range [][2]int32{{1, 0}, {-1, 0}, {0, 1}, {0, -1}} {
					nx, ny := cx+dir[0], cy+dir[1]
					if nx < 0 || nx >= z.Width || ny < 0 || ny >= z.Height {
						continue
					}
					nIdx := int(ny*z.Width + nx)
					if visited[nIdx] || z.Tiles[nIdx].Kind == "wall" {
						continue
					}
					visited[nIdx] = true
					queue = append(queue, nIdx)
				}
			}
			for _, fix := range tmpl.Fixed {
				idx := int(fix.Y*z.Width + fix.X)
				if !visited[idx] {
					t.Fatalf("seed %d zone %d: fixed landmark (%d,%d) kind=%s is unreachable from (%d,%d)",
						seed, z.ID, fix.X, fix.Y, fix.Kind, anchorX, anchorY)
				}
			}
		}
	}
}

func TestCollectiblePatternSeedAlwaysJSSafe(t *testing.T) {
	const maxJSSafeInt = int64((1 << 53) - 1)
	now := time.Now().UTC()
	w := NewDefaultWorld(now)
	p := w.Players["archon_demo"]
	p.ResourcesMilli[ResSeasonChest] = 200 * ResourceScale

	for i := 0; i < 200; i++ {
		if err := OpenSeasonChest(w, p, 0, now.Add(time.Duration(i)*time.Millisecond)); err != nil {
			t.Fatalf("open chest %d failed: %v", i, err)
		}
		item := w.Collectibles[0]
		if item.PatternSeed < 100000 || item.PatternSeed > maxJSSafeInt {
			t.Fatalf("collectible %s patternSeed=%d outside JS-safe [100000, %d]",
				item.ItemID, item.PatternSeed, maxJSSafeInt)
		}
	}
}

func TestRaidBlueprintNamesAndPotionCopyConsistent(t *testing.T) {
	checked := 0
	for _, gear := range RaidGearCatalog {
		if gear.BlueprintKey == "" {
			continue
		}
		checked++
		lootMeta, ok := RaidLootCatalogMeta[gear.BlueprintKey]
		if !ok {
			t.Fatalf("blueprint %s missing from RaidLootCatalogMeta", gear.BlueprintKey)
		}
		marketName := ResourceName(gear.BlueprintKey)
		if lootMeta.Name != marketName || gear.BlueprintName != marketName {
			t.Fatalf("blueprint %s name mismatch: loot=%q armory=%q market=%q",
				gear.BlueprintKey, lootMeta.Name, gear.BlueprintName, marketName)
		}
	}
	if checked != 10 {
		t.Fatalf("expected 10 seasonal blueprints verified, got %d", checked)
	}

	for _, gear := range RaidGearCatalog {
		if gear.ItemKey == "pot_gale_stride" {
			if strings.Contains(gear.StatSummary, "35%") || !strings.Contains(gear.StatSummary, "105ms") {
				t.Fatalf("expected pot_gale_stride stat summary to document 105ms without stale 35%% copy, got %q", gear.StatSummary)
			}
		}
	}
}

func TestEffectiveCraftOutputMilliMatchesArtisanBonus(t *testing.T) {
	now := time.Now().UTC()
	w := NewDefaultWorld(now)
	p := w.Players["archon_demo"]
	p.Profession = ProfArtisan
	p.ResourcesMilli[ResIronIngot] = 200 * ResourceScale
	p.ResourcesMilli[ResRation] = 200 * ResourceScale
	p.ResourcesMilli[ResInfantryKit] = 0

	var infSpec CraftRecipeSpec
	for _, rc := range CraftRecipeCatalog {
		if rc.RecipeCode == "craft_infantry_kit" {
			infSpec = rc
			break
		}
	}
	if got := EffectiveCraftOutputMilli(p, infSpec, 1); got != 2500 {
		t.Fatalf("expected Artisan single-batch infantry kit output 2500 milli (2.5), got %d", got)
	}
	if err := CraftItem(w, p, "craft_infantry_kit", 1, now); err != nil {
		t.Fatal(err)
	}
	if p.ResourcesMilli[ResInfantryKit] != 2500 {
		t.Fatalf("expected actual crafted infantry kit stock 2500 milli, got %d", p.ResourcesMilli[ResInfantryKit])
	}

	nonArtisan := NewBlankPlayer("non_artisan", now)
	nonArtisan.Profession = ProfAlchemist
	if got := EffectiveCraftOutputMilli(nonArtisan, infSpec, 1); got != 2000 {
		t.Fatalf("expected non-Artisan base output 2000 milli, got %d", got)
	}
}
