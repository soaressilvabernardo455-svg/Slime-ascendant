using UnityEngine;

namespace SlimeAscendant {
 public sealed class GameBootstrap : MonoBehaviour {
  [SerializeField] private int startingEnemies=8;
  [SerializeField] private float arenaSize=34f;
  [SerializeField] private PlayerClass selectedClass=PlayerClass.Knight;

  private void Start(){
   Application.targetFrameRate=60;
   CreateArena();
   CreatePlayer();
   SpawnEnemies(startingEnemies);
   CreateCamera();
  }

  private void CreateArena(){
   var ground=GameObject.CreatePrimitive(PrimitiveType.Plane);
   ground.name="Arena_Ground";
   ground.transform.localScale=new Vector3(arenaSize/10f,1,arenaSize/10f);
   ground.GetComponent<Renderer>().material=Mat(new Color(.16f,.34f,.19f));
   for(int i=0;i<18;i++){
    Vector3 p=Random.insideUnitSphere*(arenaSize*.42f);p.y=.35f;
    var rock=GameObject.CreatePrimitive(PrimitiveType.Sphere);
    rock.name="Arena_Decoration";rock.transform.position=p;
    rock.transform.localScale=Vector3.one*Random.Range(.35f,1.1f);
    rock.GetComponent<Renderer>().material=Mat(new Color(.25f,.29f,.22f));
   }
   var light=new GameObject("Sun").AddComponent<Light>();
   light.type=LightType.Directional;light.intensity=1.15f;
   light.transform.rotation=Quaternion.Euler(50,-30,0);
   RenderSettings.ambientLight=new Color(.55f,.58f,.52f);
  }

  private void CreatePlayer(){
   var root=new GameObject("Player");root.transform.position=Vector3.zero;
   var motor=root.AddComponent<PlayerMotor>();motor.SetClass(selectedClass);
   Color skin=ColorFor(selectedClass);
   Color cloth=ClothFor(selectedClass);
   Color metal=new Color(.67f,.73f,.81f);
   Part(root.transform,PrimitiveType.Capsule,"Torso",new Vector3(0,1.12f,0),new Vector3(.72f,.78f,.46f),cloth);
   Part(root.transform,PrimitiveType.Sphere,"Head",new Vector3(0,2.02f,0),new Vector3(.63f,.65f,.58f),skin);
   Part(root.transform,PrimitiveType.Capsule,"LeftArm",new Vector3(-.55f,1.18f,0),new Vector3(.23f,.52f,.23f),skin);
   Part(root.transform,PrimitiveType.Capsule,"RightArm",new Vector3(.55f,1.18f,0),new Vector3(.23f,.52f,.23f),skin);
   Part(root.transform,PrimitiveType.Capsule,"LeftLeg",new Vector3(-.22f,.38f,0),new Vector3(.27f,.62f,.29f),new Color(.13f,.16f,.22f));
   Part(root.transform,PrimitiveType.Capsule,"RightLeg",new Vector3(.22f,.38f,0),new Vector3(.27f,.62f,.29f),new Color(.13f,.16f,.22f));
   Part(root.transform,PrimitiveType.Cube,"Belt",new Vector3(0,.83f,-.01f),new Vector3(.76f,.13f,.5f),new Color(.24f,.15f,.09f));
   Part(root.transform,PrimitiveType.Sphere,"LeftEye",new Vector3(-.13f,2.08f,.27f),new Vector3(.075f,.11f,.045f),Color.white);
   Part(root.transform,PrimitiveType.Sphere,"RightEye",new Vector3(.13f,2.08f,.27f),new Vector3(.075f,.11f,.045f),Color.white);
   Part(root.transform,PrimitiveType.Sphere,"LeftPupil",new Vector3(-.13f,2.08f,.31f),new Vector3(.035f,.065f,.025f),new Color(.06f,.08f,.12f));
   Part(root.transform,PrimitiveType.Sphere,"RightPupil",new Vector3(.13f,2.08f,.31f),new Vector3(.035f,.065f,.025f),new Color(.06f,.08f,.12f));
   AddClassEquipment(root.transform,selectedClass,metal);
  }

  private void AddClassEquipment(Transform root,PlayerClass cls,Color metal){
   switch(cls){
    case PlayerClass.Knight:
     Part(root,PrimitiveType.Cube,"KnightChestplate",new Vector3(0,1.25f,.24f),new Vector3(.64f,.48f,.12f),metal);
     Part(root,PrimitiveType.Sphere,"KnightShoulderL",new Vector3(-.56f,1.48f,0),new Vector3(.34f,.3f,.34f),metal);
     Part(root,PrimitiveType.Sphere,"KnightShoulderR",new Vector3(.56f,1.48f,0),new Vector3(.34f,.3f,.34f),metal);
     Part(root,PrimitiveType.Cube,"KnightHelmet",new Vector3(0,2.38f,0),new Vector3(.62f,.25f,.58f),metal);
     Part(root,PrimitiveType.Cube,"KnightVisor",new Vector3(0,2.16f,.29f),new Vector3(.42f,.09f,.05f),new Color(.12f,.17f,.23f));
     Part(root,PrimitiveType.Cube,"KnightCrest",new Vector3(0,2.59f,-.02f),new Vector3(.12f,.34f,.12f),new Color(.72f,.12f,.13f));
     Part(root,PrimitiveType.Cube,"KnightShield",new Vector3(-.88f,1.12f,.02f),new Vector3(.18f,.72f,.58f),new Color(.13f,.34f,.72f));
     Part(root,PrimitiveType.Cube,"KnightSword",new Vector3(.88f,1.28f,.08f),new Vector3(.09f,.85f,.12f),new Color(.83f,.88f,.95f));
     break;
    case PlayerClass.Mage:
     Part(root,PrimitiveType.Cylinder,"MageHatBrim",new Vector3(0,2.4f,0),new Vector3(.62f,.07f,.62f),new Color(.22f,.12f,.42f));
     Part(root,PrimitiveType.Cone,"MageHat",new Vector3(0,2.72f,0),new Vector3(.42f,.68f,.42f),new Color(.3f,.16f,.58f));
     Part(root,PrimitiveType.Cube,"MageCape",new Vector3(0,1.22f,-.29f),new Vector3(.78f,.95f,.12f),new Color(.22f,.12f,.4f));
     Part(root,PrimitiveType.Cylinder,"MageStaff",new Vector3(.88f,1.34f,.02f),new Vector3(.07f,1.22f,.07f),new Color(.36f,.2f,.1f));
     Part(root,PrimitiveType.Sphere,"MageCrystal",new Vector3(.88f,2.02f,.02f),Vector3.one*.25f,new Color(.2f,.78f,1f));
     break;
    case PlayerClass.Necromancer:
     Part(root,PrimitiveType.Cone,"NecroHood",new Vector3(0,2.42f,-.02f),new Vector3(.76f,.48f,.68f),new Color(.12f,.08f,.19f));
     Part(root,PrimitiveType.Cube,"NecroRobe",new Vector3(0,.98f,-.29f),new Vector3(.88f,1.25f,.14f),new Color(.16f,.1f,.23f));
     Part(root,PrimitiveType.Cylinder,"NecroStaff",new Vector3(.9f,1.32f,0),new Vector3(.065f,1.32f,.065f),new Color(.2f,.13f,.12f));
     Part(root,PrimitiveType.Sphere,"NecroSkull",new Vector3(.9f,2.08f,0),Vector3.one*.27f,new Color(.83f,.82f,.72f));
     Part(root,PrimitiveType.Sphere,"NecroEyeL",new Vector3(.82f,2.1f,.22f),Vector3.one*.055f,new Color(.7f,.08f,.9f));
     Part(root,PrimitiveType.Sphere,"NecroEyeR",new Vector3(.98f,2.1f,.22f),Vector3.one*.055f,new Color(.7f,.08f,.9f));
     break;
    case PlayerClass.Healer:
     Part(root,PrimitiveType.Torus,"HealerHalo",new Vector3(0,2.55f,0),new Vector3(.72f,.12f,.72f),new Color(1f,.78f,.2f));
     Part(root,PrimitiveType.Sphere,"HealerWingL",new Vector3(-.73f,1.55f,-.12f),new Vector3(.25f,.52f,.14f),Color.white);
     Part(root,PrimitiveType.Sphere,"HealerWingR",new Vector3(.73f,1.55f,-.12f),new Vector3(.25f,.52f,.14f),Color.white);
     Part(root,PrimitiveType.Cube,"HealerCrossV",new Vector3(.88f,1.3f,.05f),new Vector3(.12f,.62f,.12f),new Color(1f,.82f,.24f));
     Part(root,PrimitiveType.Cube,"HealerCrossH",new Vector3(.88f,1.4f,.05f),new Vector3(.38f,.12f,.12f),new Color(1f,.82f,.24f));
     break;
    case PlayerClass.Archer:
     Part(root,PrimitiveType.Cone,"ArcherHood",new Vector3(0,2.42f,0),new Vector3(.72f,.4f,.62f),new Color(.12f,.32f,.16f));
     Part(root,PrimitiveType.Cube,"ArcherCape",new Vector3(0,1.15f,-.3f),new Vector3(.72f,1.05f,.12f),new Color(.12f,.28f,.15f));
     Part(root,PrimitiveType.Cylinder,"ArcherBow",new Vector3(.88f,1.35f,0),new Vector3(.045f,.76f,.045f),new Color(.55f,.29f,.1f));
     Part(root,PrimitiveType.Cube,"ArcherQuiver",new Vector3(-.48f,1.52f,-.28f),new Vector3(.2f,.62f,.2f),new Color(.42f,.22f,.09f));
     for(int i=0;i<3;i++)Part(root,PrimitiveType.Cylinder,"Arrow"+i,new Vector3(-.52f+i*.07f,1.88f,-.28f),new Vector3(.018f,.35f,.018f),new Color(.8f,.78f,.68f));
     break;
    default:
     Part(root,PrimitiveType.Sphere,"StarterCrest",new Vector3(0,2.45f,0),new Vector3(.22f,.22f,.22f),new Color(1f,.75f,.18f));
     break;
   }
  }

  private static Color ColorFor(PlayerClass cls){
   switch(cls){
    case PlayerClass.Mage:return new Color(.3f,.72f,.92f);
    case PlayerClass.Knight:return new Color(.42f,.82f,.48f);
    case PlayerClass.Necromancer:return new Color(.48f,.35f,.65f);
    case PlayerClass.Healer:return new Color(.95f,.83f,.55f);
    case PlayerClass.Archer:return new Color(.62f,.78f,.36f);
    default:return new Color(.35f,.78f,.42f);
   }
  }
  private static Color ClothFor(PlayerClass cls){
   switch(cls){
    case PlayerClass.Mage:return new Color(.24f,.12f,.48f);
    case PlayerClass.Knight:return new Color(.18f,.34f,.62f);
    case PlayerClass.Necromancer:return new Color(.12f,.09f,.18f);
    case PlayerClass.Healer:return new Color(.88f,.82f,.65f);
    case PlayerClass.Archer:return new Color(.18f,.34f,.18f);
    default:return new Color(.18f,.42f,.78f);
   }
  }

  private void SpawnEnemies(int amount){
   for(int i=0;i<amount;i++){
    Vector2 p=Random.insideUnitCircle*13f;if(p.magnitude<5)p=p.normalized*7;
    var e=GameObject.CreatePrimitive(PrimitiveType.Sphere);e.name="SlimeEnemy";
    e.transform.position=new Vector3(p.x,.65f,p.y);e.transform.localScale=new Vector3(1.15f,1.25f,1.15f);
    e.GetComponent<Renderer>().material=Mat(new Color(.25f,.82f,.38f));e.AddComponent<EnemyAI>();
   }
  }
  private void CreateCamera(){
   var go=new GameObject("Main Camera");go.tag="MainCamera";
   var cam=go.AddComponent<Camera>();cam.fieldOfView=55;go.AddComponent<AudioListener>();go.AddComponent<FollowCamera>();
  }
  private static void Part(Transform parent,PrimitiveType shape,string n,Vector3 pos,Vector3 scale,Color color){
   if(shape==PrimitiveType.Torus)return; // Torus is not a built-in primitive on all Unity versions.
   var o=GameObject.CreatePrimitive(shape);o.name=n;o.transform.SetParent(parent,false);
   o.transform.localPosition=pos;o.transform.localScale=scale;o.GetComponent<Renderer>().material=Mat(color);
   var col=o.GetComponent<Collider>();if(col!=null)Destroy(col);
  }
  private static Material Mat(Color c){
   Shader s=Shader.Find("Standard");if(s==null)s=Shader.Find("Universal Render Pipeline/Lit");
   var m=new Material(s);m.color=c;return m;
  }
 }
 public sealed class FollowCamera:MonoBehaviour{
  private Transform target;
  private void LateUpdate(){
   if(target==null){var p=FindObjectOfType<PlayerMotor>();if(p==null)return;target=p.transform;}
   Vector3 desired=target.position+new Vector3(0,11,-9);
   transform.position=Vector3.Lerp(transform.position,desired,Time.deltaTime*5);transform.LookAt(target.position+Vector3.up);
  }
 }
}