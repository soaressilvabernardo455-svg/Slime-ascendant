using UnityEngine;
namespace SlimeAscendant {
 public sealed class NecromancerPower:MonoBehaviour {
  [SerializeField] private float summonInterval=8;private float timer=2;private int level=1,maxSummons=3;
  public void Upgrade(){level=Mathf.Min(5,level+1);maxSummons=2+level;summonInterval=Mathf.Max(3,summonInterval-.8f);}
  private void Update(){timer-=Time.deltaTime;if(timer>0)return;timer=summonInterval;if(FindObjectsOfType<SkeletonAlly>().Length>=maxSummons)return;Vector2 p=Random.insideUnitCircle*1.6f;var s=GameObject.CreatePrimitive(PrimitiveType.Capsule);s.name="Necromancer_Skeleton";s.transform.position=transform.position+new Vector3(p.x,.9f,p.y);s.transform.localScale=new Vector3(.55f,.9f,.55f);s.GetComponent<Renderer>().material.color=new Color(.82f,.84f,.72f);Destroy(s.GetComponent<Collider>());s.AddComponent<SkeletonAlly>().Configure(12+level*3,6+level*2);}
 }
 public sealed class SkeletonAlly:MonoBehaviour {
  private float lifetime=28,damage,hitTimer;public void Configure(float life,float hitDamage){lifetime=life;damage=hitDamage;}
  private void Update(){lifetime-=Time.deltaTime;if(lifetime<=0){Destroy(gameObject);return;}EnemyAI target=null;float nearest=12;foreach(var e in FindObjectsOfType<EnemyAI>()){if(e==null||e.IsDead)continue;float d=Vector3.Distance(transform.position,e.transform.position);if(d<nearest){nearest=d;target=e;}}if(target==null)return;Vector3 dir=target.transform.position-transform.position;dir.y=0;if(nearest>1.2f)transform.position+=dir.normalized*3.5f*Time.deltaTime;else{hitTimer-=Time.deltaTime;if(hitTimer<=0){target.TakeDamage(damage);hitTimer=1;}}}
 }
}